from pathlib import Path
import re
import math
import numpy as np
import pandas as pd
import faiss
from app.core.embeddings import TfidfSvdEmbedder

# Standalone stopword list — the old TF-IDF vectorizer's get_stop_words() is
# gone now that we use a pretrained SBERT encoder, so keyword-extraction
# helpers (evolution/gap/summary) need their own list instead.
try:
    from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS as STOPWORDS
except ImportError:
    STOPWORDS = frozenset()

DATA_DIR = Path(__file__).resolve().parents[2] / "data"

class SearchEngine:
    def __init__(self):
        print("Loading search engine...")
        self.embedder   = TfidfSvdEmbedder.load(str(DATA_DIR / "embedder.pkl"))
        self.index      = faiss.read_index(str(DATA_DIR / "faiss.index"))
        # Load metadata without abstract to save ~40MB RAM.
        # Abstract is loaded separately only when needed for display.
        full_meta       = pd.read_parquet(DATA_DIR / "metadata.parquet")
        self.meta       = full_meta.drop(columns=["abstract"], errors="ignore")
        self.abstracts  = full_meta["abstract"].fillna("") if "abstract" in full_meta.columns else None
        del full_meta
        self.n          = len(self.meta)
        # embeddings.npy NOT loaded at startup — saves ~145MB RAM.
        # Vectors are reconstructed from the FAISS index on demand via _get_vecs().
        self.meta["approx_quartile"] = self.meta["approx_quartile"].fillna("")
        print(f"Search engine ready: {self.n} papers")

    def _get_vecs(self, idxs):
        """Reconstruct raw vectors from FAISS index (avoids keeping embeddings.npy in RAM)."""
        idxs = np.array(idxs, dtype=np.int64)
        vecs = np.zeros((len(idxs), self.index.d), dtype=np.float32)
        for i, idx in enumerate(idxs):
            self.index.reconstruct(int(idx), vecs[i])
        return vecs

    # When scimago_only is set, only ~23% of papers survive the filter, so
    # retrieving a fixed pool_size and filtering afterward starves every
    # downstream feature (thin clusters, "not enough papers" errors, etc).
    # Scale the FAISS retrieval size up first so filtering still leaves a
    # healthy sample.
    SCIMAGO_OVERSAMPLE = 6

    def _retrieve_k(self, pool_size, scimago_only):
        k = pool_size * self.SCIMAGO_OVERSAMPLE if scimago_only else pool_size
        return min(self.n, k)

    def embed(self, text: str):
        return self.embedder.transform([text])

    # ── SEARCH ───────────────────────────────────────────────────────────────
    # Now that embeddings come from Sentence-BERT (not TF-IDF+SVD), the
    # standard relatedness scale actually applies here:
    #   <0.40 unrelated · 0.40-0.60 distantly related · 0.60-0.70 broadly
    #   related · 0.70-0.85 same topic · >0.85 near-identical.
    # 0.40 filters genuinely unrelated results while keeping distant-but-
    # real matches. Re-tune after rebuilding the index if it feels off.
    MIN_SIMILARITY = 0.4

    def search(self, query, top_k=10, min_year=None, max_year=None,
               quartiles=None, min_citations=None, oversample=8,
               scimago_only=False, min_similarity=None):
        vec = self.embed(query)
        k   = self._retrieve_k(top_k * oversample + 100, scimago_only)
        scores, idxs = self.index.search(vec, k)
        rows = self.meta.iloc[idxs[0]].copy()
        rows["similarity"] = scores[0]

        thresh = self.MIN_SIMILARITY if min_similarity is None else min_similarity
        rows = rows[rows["similarity"] >= thresh]

        if min_year:     rows = rows[rows["year"] >= min_year]
        if max_year:     rows = rows[rows["year"] <= max_year]
        if min_citations: rows = rows[rows["citations"] >= min_citations]
        if scimago_only:
            rows = rows[rows["quartile"] != "Unknown"]
        if quartiles:
            aq = rows["approx_quartile"].fillna("")
            rows = rows[rows["quartile"].isin(quartiles) | aq.isin(quartiles)]

        return rows.head(top_k).reset_index(drop=True)

    # ── SIMILAR ───────────────────────────────────────────────────────────────
    def similar(self, paper_id, top_k=10, min_similarity=None):
        row = self.meta[self.meta["paper_id"] == paper_id]
        if row.empty: return pd.DataFrame()
        idx  = int(row.iloc[0]["row_id"])
        vec  = self._get_vecs([idx])
        scores, idxs = self.index.search(vec, top_k + 1)
        results = self.meta.iloc[idxs[0]].copy()
        results["similarity"] = scores[0]
        results = results[results["paper_id"] != paper_id]
        thresh = self.MIN_SIMILARITY if min_similarity is None else min_similarity
        results = results[results["similarity"] >= thresh]
        return results.head(top_k).reset_index(drop=True)

    # ── TREND ────────────────────────────────────────────────────────────────
    def trend(self, query, pool_size=1200, scimago_only=False):
        vec = self.embed(query)
        k   = self._retrieve_k(pool_size, scimago_only)
        _, idxs = self.index.search(vec, k)
        rows = self.meta.iloc[idxs[0]].reset_index(drop=True).copy()
        rows = rows[rows["year"].notna()]
        if scimago_only:
            rows = rows[rows["quartile"] != "Unknown"]
        rows = rows.head(pool_size).reset_index(drop=True)
        counts = rows.groupby("year").size().reset_index(name="count")
        counts["year"] = counts["year"].astype(int)
        return counts.sort_values("year")

    # ── EVOLUTION ────────────────────────────────────────────────────────────
    def evolution(self, query, pool_size=800, top_terms=8, scimago_only=False):
        vec = self.embed(query)
        k   = self._retrieve_k(pool_size, scimago_only)
        _, idxs = self.index.search(vec, k)
        rows = self.meta.iloc[idxs[0]].copy()
        rows = rows[rows["year"].notna()]
        if scimago_only:
            rows = rows[rows["quartile"] != "Unknown"]
        rows = rows.head(pool_size)  # cap after filter
        stop = STOPWORDS
        qt   = set(re.findall(r"[a-z]+", query.lower()))
        buckets = []
        for year, grp in rows.groupby("year"):
            titles = grp["title"].fillna("")
            if self.abstracts is not None:
                absts = self.abstracts.iloc[grp.index].fillna("")
            else:
                absts = pd.Series([""] * len(grp), index=grp.index)
            blob  = " ".join((titles + " " + absts).str.lower())
            words = [w for w in re.findall(r"[a-z]{3,}", blob) if w not in stop and w not in qt]
            freq  = pd.Series(words).value_counts()
            buckets.append({
                "year": int(year), "paper_count": int(len(grp)),
                "top_terms": freq.head(top_terms).index.tolist(),
                "sample_titles": grp["title"].head(3).tolist(),
            })
        buckets.sort(key=lambda b: b["year"])
        return buckets

    # ── CLUSTER ───────────────────────────────────────────────────────────────
    def cluster(self, query, pool_size=500, n_clusters=5, scimago_only=False):
        from sklearn.cluster import KMeans
        from sklearn.decomposition import PCA
        vec = self.embed(query)
        k   = self._retrieve_k(pool_size, scimago_only)
        _, idxs = self.index.search(vec, k)
        idxs = idxs[0]
        rows = self.meta.iloc[idxs].reset_index(drop=True)
        if scimago_only:
            mask = rows["quartile"] != "Unknown"
            rows = rows[mask].reset_index(drop=True)
            idxs = idxs[mask.values]
            # cap back down to the requested pool size (still relevance-ranked)
            rows = rows.head(pool_size).reset_index(drop=True)
            idxs = idxs[:pool_size]
        sub  = self._get_vecs(idxs)
        if len(rows) < n_clusters * 2:
            n_clusters = max(2, len(rows) // 5)
        km     = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = km.fit_predict(sub)
        pca    = PCA(n_components=2, random_state=42)
        coords = pca.fit_transform(sub)
        rows["cluster"] = labels
        rows["x"] = coords[:, 0]
        rows["y"] = coords[:, 1]
        stop = STOPWORDS

        # Build per-cluster word frequencies first
        cluster_freqs = {}
        for c in range(n_clusters):
            cr     = rows[rows["cluster"] == c]
            titles = cr["title"].fillna("")
            if self.abstracts is not None:
                absts = self.abstracts.iloc[cr.index].fillna("")
            else:
                absts = pd.Series([""] * len(cr), index=cr.index)
            blob   = " ".join((titles + " " + absts).str.lower())
            words  = [w for w in re.findall(r"[a-z]{4,}", blob) if w not in stop]
            cluster_freqs[c] = pd.Series(words).value_counts()

        # Find words that appear in the top-20 of MORE than 60% of clusters
        # These are corpus-generic terms that don't differentiate clusters
        all_top = {}
        for c, freq in cluster_freqs.items():
            for w in freq.head(20).index:
                all_top[w] = all_top.get(w, 0) + 1
        generic = {w for w, cnt in all_top.items() if cnt > n_clusters * 0.6}

        # Also add query words as generic (don't label clusters with the search term)
        qt = set(re.findall(r"[a-z]+", query.lower()))
        generic |= qt

        clabels = {}
        for c in range(n_clusters):
            freq = cluster_freqs[c]
            # Filter out generic and query terms, pick top 5 distinctive words
            distinctive = [w for w in freq.index if w not in generic and len(w) > 3]
            clabels[c] = distinctive[:5] if distinctive else freq.head(5).index.tolist()
        return rows, clabels

    # ── GAP ───────────────────────────────────────────────────────────────────
    def gap(self, query, pool_size=1500, scimago_only=False):
        import numpy as np
        vec = self.embed(query)
        k   = self._retrieve_k(pool_size, scimago_only)
        scores, idxs = self.index.search(vec, k)
        rows = self.meta.iloc[idxs[0]].copy()
        rows = rows[rows["year"].notna() & (rows["year"] >= 2000)]
        rows["similarity"] = scores[0][:len(rows)]
        if scimago_only:
            rows = rows[rows["quartile"] != "Unknown"]
        rows = rows.head(pool_size)  # cap after filter
        if len(rows) < 10:
            return {"query": query, "gaps": [], "total_papers_analyzed": 0,
                    "year_range": {}, "year_distribution": [],
                    "summary": "Not enough papers found.", "scimago_only": scimago_only}

        year_counts  = rows.groupby("year").size().reset_index(name="count")
        year_counts["year"] = year_counts["year"].astype(int)
        all_years    = list(range(int(year_counts["year"].min()), int(year_counts["year"].max()) + 1))
        count_by_year = dict(zip(year_counts["year"].astype(int), year_counts["count"].astype(int)))

        counts = [count_by_year.get(y, 0) for y in all_years]
        window = 3
        gaps   = []
        for i, yr in enumerate(all_years):
            lo = max(0, i - window); hi = min(len(counts), i + window + 1)
            neighbors = counts[lo:i] + counts[i+1:hi]
            if not neighbors: continue
            avg = sum(neighbors) / len(neighbors)
            actual = counts[i]
            if avg > 3 and actual < avg * 0.45:
                gaps.append({
                    "year": yr, "papers_found": actual,
                    "expected": round(avg, 1),
                    "gap_severity": round(1 - actual / avg, 2),
                    "type": "temporal_gap",
                    "insight": f"{yr} had only {actual} papers vs ~{round(avg)} expected — significantly under-researched year for this topic"
                })

        stop = STOPWORDS
        qt   = set(re.findall(r"[a-z]+", query.lower()))
        high_sim = rows[rows["similarity"] >= rows["similarity"].quantile(0.7)]
        low_sim  = rows[rows["similarity"] < rows["similarity"].quantile(0.3)]

        def top_words(df_sub, n=8):
            titles = df_sub["title"].fillna("")
            if self.abstracts is not None:
                absts = self.abstracts.iloc[df_sub.index].fillna("")
            else:
                absts = pd.Series([""] * len(df_sub), index=df_sub.index)
            blob  = " ".join((titles + " " + absts).str.lower())
            words = [w for w in re.findall(r"[a-z]{4,}", blob) if w not in stop and w not in qt]
            return [w for w, _ in pd.Series(words).value_counts().head(n).items()]

        dominant = set(top_words(high_sim))
        subtopic_gaps = []
        for term in top_words(low_sim, 12):
            if term in dominant: continue
            title_mask = rows["title"].str.lower().str.contains(term, na=False)
            if self.abstracts is not None:
                abst_mask = self.abstracts.iloc[rows.index].str.lower().str.contains(term, na=False)
            else:
                abst_mask = pd.Series([False] * len(rows), index=rows.index)
            mask = title_mask | abst_mask
            if mask.sum() < 5:
                subtopic_gaps.append({
                    "year": None, "type": "subtopic_gap", "term": term,
                    "papers_found": int(mask.sum()),
                    "insight": f'"{term}" appears rarely in {query} literature ({mask.sum()} papers) — potentially under-explored angle'
                })

        all_gaps = sorted(gaps, key=lambda g: -g["gap_severity"]) + subtopic_gaps[:5]
        return {
            "query": query, "total_papers_analyzed": len(rows), "scimago_only": scimago_only,
            "year_range": {"min": int(rows["year"].min()), "max": int(rows["year"].max())},
            "year_distribution": [{"year": int(y), "count": count_by_year.get(int(y), 0)} for y in all_years],
            "gaps": all_gaps,
            "summary": f"Found {len(gaps)} temporal gaps and {len(subtopic_gaps)} under-explored subtopics in '{query}' research"
        }

    # ── DUPLICATES ────────────────────────────────────────────────────────────
    def duplicates(self, query, pool_size=300, threshold=0.85):
        vec = self.embed(query)
        k   = min(self.n, pool_size)
        _, idxs = self.index.search(vec, k)
        idxs = idxs[0]
        sub  = self._get_vecs(idxs)
        rows = self.meta.iloc[idxs].reset_index(drop=True)
        sim  = sub @ sub.T
        pairs = []
        for i in range(len(rows)):
            for j in range(i+1, len(rows)):
                if sim[i,j] >= threshold:
                    pairs.append({
                        "paper_a": rows.iloc[i]["title"],
                        "paper_b": rows.iloc[j]["title"],
                        "similarity": float(sim[i,j]),
                    })
        pairs.sort(key=lambda p: -p["similarity"])
        return pairs

    # ── STATS ────────────────────────────────────────────────────────────────
    def stats(self):
        meta     = self.meta
        real_q   = meta[meta["quartile"] != "Unknown"]["quartile"].value_counts().to_dict()
        approx_q = meta[(meta["quartile"] == "Unknown") & (meta["approx_quartile"] != "")]["approx_quartile"].value_counts().to_dict()
        tv       = meta["venue"].value_counts().head(12).reset_index()
        tv.columns = ["venue", "count"]
        return {
            "total_papers": int(len(meta)),
            "year_min": int(meta["year"].min()),
            "year_max": int(meta["year"].max()),
            "real_quartile_distribution":   [{"quartile":q,"count":int(c)} for q,c in real_q.items()],
            "approx_quartile_distribution": [{"quartile":q,"count":int(c)} for q,c in approx_q.items()],
            "matched_count": int((meta["quartile"] != "Unknown").sum()),
            "top_venues": tv.to_dict(orient="records"),
        }

_engine = None
def get_engine():
    global _engine
    if _engine is None:
        _engine = SearchEngine()
    return _engine
