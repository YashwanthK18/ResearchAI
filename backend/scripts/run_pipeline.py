"""
run_pipeline.py
===============
Run this script on your local machine to rebuild the dataset and index
from your full cse_papers.jsonl (165k papers).

Place this file inside backend/ and run:
    python run_pipeline.py

It does in one shot:
  1. SCImago quartile matching (combine.py logic)
  2. Approximate quartile estimation for unmatched papers
  3. TF-IDF + SVD embeddings
  4. FAISS index build
  5. Metadata parquet

Expects:
  backend/data/raw/cse_papers.jsonl          (your 165k paper file)
  backend/data/raw/scimagojr_YYYY__...csv    (2000-2025, all years you have)
"""

import json, re, sys, time, pickle
from pathlib import Path
from collections import defaultdict

import numpy as np
import pandas as pd
import faiss
from rapidfuzz import process, fuzz
from sentence_transformers import SentenceTransformer

BASE    = Path(__file__).resolve().parent[1]
RAW_DIR = BASE / "data" / "raw"
DATA    = BASE / "data"

# ── CONFIG ──────────────────────────────────────────────────────────────
PAPERS_FILE    = RAW_DIR / "cse_papers.jsonl"
OUTPUT_ENRICHED= DATA / "cse_papers_with_quartiles.jsonl"
FAISS_INDEX    = DATA / "faiss.index"
EMBEDDER_FILE  = DATA / "embedder.pkl"
META_FILE      = DATA / "metadata.parquet"
EMBEDDINGS_FILE= DATA / "embeddings.npy"
MODEL_NAME     = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM  = 384
FUZZY_THRESHOLD= 87
# ────────────────────────────────────────────────────────────────────────

def clean(t):
    t = str(t).lower()
    t = re.sub(r"[^a-z0-9 ]"," ",t)
    return re.sub(r"\s+"," ",t).strip()

def strip_noise(t):
    t = re.sub(r"^\d{4}\s+","",t)
    t = re.sub(r"\b(ieee|acm|cvf)\b"," ",t)
    return re.sub(r"\s+"," ",t).strip()

def parse_float(v):
    try:
        s = str(v).strip().replace(",",".")
        return None if s in ("","-","nan","NaN") else float(s)
    except: return None

# ── STEP 1: LOAD SCIMAGO ────────────────────────────────────────────────
print("\n[1/5] Loading SCImago rankings...")
scimago = {}
for yr in range(2000, 2026):
    fp = RAW_DIR / f"scimagojr_{yr}__Subject_Area_-_Computer_Science.csv"
    if not fp.exists():
        continue
    try:
        df = pd.read_csv(fp, sep=";", engine="python", on_bad_lines="skip")
        lookup, stripped = {}, {}
        for _, row in df.iterrows():
            t = clean(str(row.get("Title","")))
            if not t: continue
            q = str(row.get("SJR Best Quartile","")).strip()
            if q in ("-","","nan"): q = "Unknown"
            entry = {"quartile": q, "sjr_score": parse_float(row.get("SJR")),
                     "h_index": parse_float(row.get("H index"))}
            if t not in lookup or (lookup[t]["quartile"]=="Unknown" and q!="Unknown"):
                lookup[t] = entry
            s = strip_noise(t)
            if s and s not in stripped: stripped[s] = entry
        scimago[yr] = (lookup, stripped)
        print(f"  {yr}: {len(lookup)} entries")
    except Exception as e:
        print(f"  {yr}: ERROR {e}")

min_yr = min(scimago) if scimago else 2016
max_yr = max(scimago) if scimago else 2025
print(f"Loaded {len(scimago)} years ({min_yr}–{max_yr})")

def nearest_yr(y):
    return max(min_yr, min(max_yr, y))

def match_venue(venue, year):
    if not venue or not year: return None
    try: year = int(year)
    except: return None
    ly = nearest_yr(year)
    if ly not in scimago: return None
    lk, sl = scimago[ly]
    v = clean(venue)
    if v in lk: return lk[v]
    vs = strip_noise(v)
    if vs in sl: return sl[vs]
    res = process.extractOne(vs, list(sl.keys()), scorer=fuzz.token_sort_ratio, score_cutoff=FUZZY_THRESHOLD)
    if res: return sl[res[0]]
    res = process.extractOne(v, list(lk.keys()), scorer=fuzz.token_sort_ratio, score_cutoff=FUZZY_THRESHOLD)
    if res: return lk[res[0]]
    return None

# ── STEP 2: LOAD + ENRICH PAPERS ────────────────────────────────────────
print("\n[2/5] Loading and enriching papers...")
papers = []
with open(PAPERS_FILE, encoding="utf-8") as f:
    for i, line in enumerate(f):
        try: papers.append(json.loads(line))
        except: pass
        if (i+1) % 20000 == 0: print(f"  loaded {i+1:,}")
print(f"  Total: {len(papers):,}")

matched = 0
c=0
for p in papers:
    m = match_venue(p.get("venue",""), p.get("year"))
    if m:
        p["quartile"]  = m["quartile"]
        p["sjr_score"] = m["sjr_score"]
        p["h_index"]   = m["h_index"]
        matched += 1
    else:
        p["quartile"]  = "Unknown"
        p["sjr_score"] = None
        p["h_index"]   = None
    c+=1
    if (c) % 20000 == 0: print(f"  loaded {i+1:,}")

print(f"  Matched: {matched:,} / {len(papers):,} ({matched/len(papers)*100:.1f}%)")

# ── STEP 3: APPROXIMATE QUARTILES FOR UNMATCHED ─────────────────────────
print("\n[3/5] Computing approximate quartiles for unmatched papers...")
import bisect
year_cites = defaultdict(list)
for p in papers:
    y = p.get("year")
    if y: year_cites[y].append(p.get("citations",0) or 0)
year_sorted = {y: sorted(c) for y, c in year_cites.items()}

def cite_pct(year, cite):
    s = year_sorted.get(year,[])
    if not s: return 0.5
    return bisect.bisect_left(s, cite) / len(s)

approx_counts = defaultdict(int)
for p in papers:
    if p["quartile"] == "Unknown":
        pct = cite_pct(p.get("year"), p.get("citations",0) or 0)
        aq  = "~Q1" if pct>=0.75 else "~Q2" if pct>=0.50 else "~Q3" if pct>=0.25 else "~Q4"
        p["approx_quartile"] = aq
        approx_counts[aq] += 1
    else:
        p["approx_quartile"] = None

print("  Approx distribution:", dict(approx_counts))

# Save enriched dataset
with open(OUTPUT_ENRICHED,"w",encoding="utf-8") as f:
    for p in papers: f.write(json.dumps(p,ensure_ascii=False)+"\n")
print(f"  Saved: {OUTPUT_ENRICHED}")

# ── STEP 4: EMBED ────────────────────────────────────────────────────────
print(f"\n[4/5] Building Sentence-BERT embeddings ({MODEL_NAME}, dim={EMBEDDING_DIM})...")
texts = [f"{p.get('title','')}. {p.get('abstract','')}" for p in papers]

t0 = time.time()
model = SentenceTransformer(MODEL_NAME)
embs  = model.encode(
    texts,
    batch_size=64,
    show_progress_bar=True,
    convert_to_numpy=True,
    normalize_embeddings=True,   # so FAISS inner product == cosine similarity
).astype("float32")
print(f"  Shape: {embs.shape} in {time.time()-t0:.1f}s")

# Save embedder (just the model name — nothing to "fit" for a pretrained model)
with open(EMBEDDER_FILE,"wb") as f:
    pickle.dump({"model_name": MODEL_NAME, "n_components": EMBEDDING_DIM}, f)

np.save(EMBEDDINGS_FILE, embs)

# ── STEP 5: FAISS INDEX ─────────────────────────────────────────────────
print("\n[5/5] Building FAISS index...")
index = faiss.IndexFlatIP(EMBEDDING_DIM)
index.add(embs)
faiss.write_index(index, str(FAISS_INDEX))
print(f"  FAISS index: {index.ntotal:,} vectors")

# Metadata
meta = pd.DataFrame([{
    "row_id": i, "paper_id": p.get("paper_id"), "title": p.get("title"),
    "abstract": p.get("abstract"), "year": p.get("year"), "venue": p.get("venue"),
    "citations": p.get("citations"), "quartile": p.get("quartile"),
    "approx_quartile": p.get("approx_quartile"),
    "sjr_score": p.get("sjr_score"), "h_index": p.get("h_index"),
} for i,p in enumerate(papers)])
meta.to_parquet(META_FILE)
print(f"  Metadata: {len(meta):,} rows → {META_FILE}")

print("\n✅ Pipeline complete! Restart uvicorn to pick up the new index.")
print(f"   Papers: {len(papers):,} | Matched: {matched:,} | Indexed: {index.ntotal:,}")
