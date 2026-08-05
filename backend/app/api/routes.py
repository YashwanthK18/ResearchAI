from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import math, pandas as pd

from app.core.search_engine import get_engine
from app.core.pdf_utils import extract_text_from_pdf

router = APIRouter()

def _clean(v):
    if v is None: return None
    try:
        if pd.isna(v): return None
    except: pass
    return v

def sf(v):
    v = _clean(v)
    if v is None: return None
    try:
        f = float(v); return None if math.isnan(f) else round(f, 4)
    except: return None

def si(v):
    v = _clean(v)
    if v is None: return None
    try:
        f = float(v); return None if math.isnan(f) else int(f)
    except: return None

def ss(v):
    v = _clean(v)
    return None if v is None else str(v)

def row_to_dict(row):
    def g(k):
        val = row.get(k) if hasattr(row,"get") else getattr(row,k,None)
        return _clean(val)
    q  = g("quartile") or "Unknown"
    aq = g("approx_quartile") or ""
    display_q = q if q != "Unknown" else (aq or "Unknown")
    return {
        "paper_id":         ss(g("paper_id")),
        "title":            g("title") or "",
        "abstract":         (g("abstract") or "")[:800],
        "year":             si(g("year")),
        "venue":            ss(g("venue")),
        "citations":        si(g("citations")),
        "quartile":         q,
        "approx_quartile":  aq or None,
        "display_quartile": display_q,
        "is_approx":        q == "Unknown" and bool(aq),
        "sjr_score":        sf(g("sjr_score")),
        "h_index":          sf(g("h_index")),
        "similarity":       float(g("similarity") or 0.0),
    }

# ── SEARCH ───────────────────────────────────────────────────────────────────
class SearchReq(BaseModel):
    query: str
    top_k: int = 10
    min_year: Optional[int] = None
    max_year: Optional[int] = None
    quartiles: Optional[list[str]] = None
    min_citations: Optional[int] = None
    scimago_only: Optional[bool] = False
    min_similarity: Optional[float] = None

@router.post("/search")
def search(req: SearchReq):
    if not req.query.strip(): raise HTTPException(400, "Query must not be empty")
    engine = get_engine()
    df = engine.search(req.query, req.top_k, req.min_year, req.max_year,
                       req.quartiles, req.min_citations, scimago_only=req.scimago_only,
                       min_similarity=req.min_similarity)
    return {"query": req.query, "results": [row_to_dict(r) for _,r in df.iterrows()], "count": len(df)}

@router.post("/search/pdf")
async def search_pdf(file: UploadFile = File(...), top_k: int = Query(10)):
    raw = await file.read()
    try: text = extract_text_from_pdf(raw)
    except Exception as e: raise HTTPException(400, f"Could not read PDF: {e}")
    if not text.strip(): raise HTTPException(400, "No text found in PDF")
    engine = get_engine()
    df = engine.search(text, top_k)
    return {"query": text[:200]+"...", "results": [row_to_dict(r) for _,r in df.iterrows()], "count": len(df)}

@router.get("/similar/{paper_id}")
def similar(paper_id: str, top_k: int = Query(8)):
    engine = get_engine()
    df = engine.similar(paper_id, top_k)
    return {"results": [row_to_dict(r) for _,r in df.iterrows()], "count": len(df)}

# ── TREND ────────────────────────────────────────────────────────────────────
@router.get("/trend")
def trend(query: str = Query(...), pool_size: int = Query(1200),
          scimago_only: bool = Query(False)):
    engine = get_engine()
    df = engine.trend(query, pool_size, scimago_only=scimago_only)
    return {
        "query": query, "scimago_only": scimago_only,
        "points": [{"year": int(r.year), "count": int(r["count"])} for _,r in df.iterrows()],
        "total_matched": int(df["count"].sum()),
    }

# ── EVOLUTION ────────────────────────────────────────────────────────────────
@router.get("/evolution")
def evolution(query: str = Query(...), pool_size: int = Query(800),
              scimago_only: bool = Query(False)):
    engine = get_engine()
    return {"query": query, "scimago_only": scimago_only,
            "buckets": engine.evolution(query, pool_size, scimago_only=scimago_only)}

# ── CLUSTER ───────────────────────────────────────────────────────────────────
@router.get("/cluster")
def cluster(query: str = Query(...), pool_size: int = Query(500),
            n_clusters: int = Query(5), scimago_only: bool = Query(False)):
    engine = get_engine()
    try:
        rows, clabels = engine.cluster(query, pool_size, n_clusters, scimago_only=scimago_only)
    except Exception as e:
        raise HTTPException(500, f"Clustering failed: {str(e)}")
    points = []
    for _, r in rows.iterrows():
        aq = _clean(r.get("approx_quartile")) or ""
        points.append({
            "paper_id": ss(r.get("paper_id")), "title": r.get("title") or "",
            "year": si(r.get("year")), "quartile": r.get("quartile") or "Unknown",
            "approx_quartile": aq or None,
            "cluster": int(r["cluster"]), "x": float(r["x"]), "y": float(r["y"]),
        })
    return {"query": query, "n_clusters": len(clabels), "points": points, "cluster_labels": clabels}

# ── GAP ───────────────────────────────────────────────────────────────────────
@router.get("/gap")
def gap(query: str = Query(...), pool_size: int = Query(1500),
        scimago_only: bool = Query(False)):
    engine = get_engine()
    return engine.gap(query, pool_size, scimago_only=scimago_only)

# ── DUPLICATES ────────────────────────────────────────────────────────────────
@router.get("/duplicates")
def duplicates(query: str = Query(...), pool_size: int = Query(300),
               threshold: float = Query(0.85)):
    engine = get_engine()
    return {"query": query, "threshold": threshold,
            "pairs": engine.duplicates(query, pool_size, threshold)}

# ── CHECK MY WORK ─────────────────────────────────────────────────────────────
class DupCheckReq(BaseModel):
    text: str
    top_k: int = 15
    threshold: float = 0.75   # SBERT cosine scale — 0.70-0.85 = same topic, >0.85 = near-identical

@router.post("/check_duplicate")
def check_duplicate(req: DupCheckReq):
    if not req.text.strip(): raise HTTPException(400, "Text must not be empty")
    if len(req.text.strip()) < 50:
        raise HTTPException(400, "Please provide more text — at least a full abstract (50+ characters)")
    engine = get_engine()
    vec = engine.embed(req.text)
    k   = min(engine.n, req.top_k * 10 + 300)
    scores, idxs = engine.index.search(vec, k)
    results = []
    for score, idx in zip(scores[0], idxs[0]):
        if float(score) < req.threshold: continue
        row = engine.meta.iloc[idx]
        d   = row_to_dict(row)
        d["similarity"] = float(score)
        results.append(d)
        if len(results) >= req.top_k: break
    # If nothing found at user threshold, return top 5 regardless with note
    fallback = False
    if len(results) == 0:
        fallback = True
        for score, idx in zip(scores[0][:5], idxs[0][:5]):
            row = engine.meta.iloc[idx]
            d   = row_to_dict(row)
            d["similarity"] = float(score)
            results.append(d)
    return {
        "query_preview": req.text[:150] + ("..." if len(req.text)>150 else ""),
        "threshold": req.threshold,
        "results": results,
        "count": len(results),
        "fallback": fallback,
        "warning": (
            "No papers exceeded the similarity threshold. Showing top 5 most similar papers for reference — these are likely just related work, not duplicates."
            if fallback else
            "High similarity does not mean plagiarism — it may indicate related work. Read papers carefully and judge yourself."
        ),
    }

# ── TOPIC SUMMARY ─────────────────────────────────────────────────────────────
@router.get("/summary")
def topic_summary(query: str = Query(...), pool_size: int = Query(100),
                  scimago_only: bool = Query(False)):
    import re
    from collections import Counter
    engine = get_engine()
    vec  = engine.embed(query)
    k    = engine._retrieve_k(pool_size, scimago_only)
    scores, idxs = engine.index.search(vec, k)
    rows = engine.meta.iloc[idxs[0]].copy()
    rows["similarity"] = scores[0]
    rows = rows[rows["similarity"] >= engine.MIN_SIMILARITY]
    if scimago_only:
        rows = rows[rows["quartile"] != "Unknown"]
    rows = rows.head(pool_size)

    papers_info = []
    for _, r in rows.iterrows():
        aq = _clean(r.get("approx_quartile")) or ""
        q  = r.get("quartile") or "Unknown"
        papers_info.append({
            "title":    r.get("title") or "",
            "abstract": (r.get("abstract") or "")[:400],
            "year":     si(r.get("year")),
            "venue":    ss(r.get("venue")),
            "citations":si(r.get("citations")),
            "quartile": q,
            "approx_quartile": aq or None,
            "display_quartile": q if q != "Unknown" else (aq or "Unknown"),
            "is_approx": q == "Unknown" and bool(aq),
            "similarity": float(r.get("similarity", 0)),
        })

    from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS as STOPWORDS
    stop     = STOPWORDS
    qt       = set(re.findall(r"[a-z]+", query.lower()))
    all_text = " ".join(p["abstract"] for p in papers_info).lower()
    words    = [w for w in re.findall(r"[a-z]{4,}", all_text)
                if w not in stop and w not in qt]
    freq     = Counter(words)
    top_methods = freq.most_common(15)
    years    = [p["year"] for p in papers_info if p["year"]]

    # Build a simple narrative summary from the top terms + year range
    top5 = [w for w,_ in top_methods[:5]]
    yr_min = min(years) if years else None
    yr_max = max(years) if years else None
    narrative = (
        f"Research on '{query}' spans from {yr_min} to {yr_max}, "
        f"with {len(papers_info)} relevant papers analyzed. "
        f"Key themes include {', '.join(top5[:3])}. "
        f"{sum(1 for p in papers_info if p['quartile']=='Q1')} papers appear in Q1 journals."
        if yr_min else f"Analyzed {len(papers_info)} papers on '{query}'."
    )

    # Venue frequency
    venue_freq = Counter(p["venue"] for p in papers_info if p["venue"])

    return {
        "query":            query,
        "scimago_only":     scimago_only,
        "papers_analyzed":  len(papers_info),
        "top_papers":       papers_info[:10],
        "all_papers":       papers_info,
        "key_terms":        [w for w,_ in top_methods],
        "year_range":       {"min": yr_min, "max": yr_max},
        "q1_count":         sum(1 for p in papers_info if p["quartile"]=="Q1"),
        "narrative":        narrative,
        "venues":           [{"name":v,"count":c} for v,c in venue_freq.most_common(8)],
    }

# ── STATS ─────────────────────────────────────────────────────────────────────
@router.get("/stats")
def stats():
    return get_engine().stats()

@router.get("/health")
def health():
    engine = get_engine()
    return {"status": "ok", "papers_indexed": engine.n}
