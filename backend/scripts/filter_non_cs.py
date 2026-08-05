"""
filter_non_cs.py
================
Removes non-CS papers from cse_papers_with_quartiles.jsonl based on
venue signals, then rebuilds the FAISS index.

Run from backend/ folder:
    python scripts/filter_non_cs.py

This is a one-time cleanup step. It modifies the enriched dataset in place
(with a backup) and rebuilds the index automatically.
"""

import json, re, shutil, sys, time, pickle
from pathlib import Path
from collections import Counter

import numpy as np
import faiss
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

BASE = Path(__file__).resolve().parents[1]
DATA = BASE / "data"
INPUT  = DATA / "cse_papers_with_quartiles.jsonl"
BACKUP = DATA / "cse_papers_with_quartiles_backup.jsonl"
OUTPUT = DATA / "cse_papers_with_quartiles.jsonl"

# Venue strings that reliably indicate a non-CS publication.
# Kept deliberately narrow to avoid removing legitimate interdisciplinary
# CS papers (e.g. bioinformatics, computational neuroscience ARE CS).
NON_CS_VENUE_SIGNALS = [
    "remote sensing",
    "geoscience",
    "geograph",
    "igarss",
    "photogramm",
    "radiol",
    "lancet",
    "nejm",
    "new england journal",
    "bmj ",
    "british medical journal",
    "oncol",
    "cancer",
    "cardiol",
    "neurol",
    "psychiatr",
    "ophthalmol",
    "dermatol",
    "journal of physics",
    "physical review",
    "astrophys",
    "astronomy",
    "atmospheric",
    "ocean",
    "ecology",
    "ecolog",
    "agricultur",
    "agronomy",
    "soil",
    "water resources",
    "hydrol",
    "geology",
    "geolog",
    "seismol",
    "mineralog",
    "petroleum",
    "chemical engineering",
    "materials science",
    "metallurg",
    "polymer",
    "textile",
    "food science",
    "nutrition",
    "pharmacy",
    "pharmacol",
    "toxicol",
    "veterinar",
    "dental",
    "nursing",
]

# CS-adjacent venues to explicitly KEEP even if they trigger a signal above
CS_KEEP_SIGNALS = [
    "ieee transactions on biomedical",
    "bmc bioinformatics",
    "bioinformatics",
    "computational biology",
    "plos computational",
    "journal of biomedical informatics",
    "medical image",
    "medical imaging",
    "health informatics",
    "clinical decision",
    "computer methods",
    "computational neuroscience",
    "neuroinformatics",
]

def is_non_cs(venue: str) -> bool:
    if not venue:
        return False
    vl = venue.lower()
    # Explicit keep overrides everything
    if any(k in vl for k in CS_KEEP_SIGNALS):
        return False
    return any(s in vl for s in NON_CS_VENUE_SIGNALS)

# ── LOAD ────────────────────────────────────────────────────────────────────
print("Loading papers...")
papers = []
with open(INPUT, encoding="utf-8") as f:
    for line in f:
        try: papers.append(json.loads(line))
        except: pass
print(f"  Loaded: {len(papers):,}")

# ── FILTER ──────────────────────────────────────────────────────────────────
kept, removed = [], []
removed_venues = Counter()
for p in papers:
    venue = p.get("venue", "") or ""
    if is_non_cs(venue):
        removed.append(p)
        removed_venues[venue] += 1
    else:
        kept.append(p)

print(f"  Kept:    {len(kept):,}")
print(f"  Removed: {len(removed):,}")
print("\nTop removed venues:")
for v, c in removed_venues.most_common(15):
    print(f"  {c:5d}  {v}")

confirm = input(f"\nProceed? This will remove {len(removed):,} papers and rebuild the index. (yes/no): ").strip().lower()
if confirm != "yes":
    print("Aborted.")
    sys.exit(0)

# ── BACKUP + SAVE ────────────────────────────────────────────────────────────
shutil.copy(INPUT, BACKUP)
print(f"\nBackup saved: {BACKUP}")

with open(OUTPUT, "w", encoding="utf-8") as f:
    for p in kept:
        f.write(json.dumps(p, ensure_ascii=False) + "\n")
print(f"Filtered dataset saved: {OUTPUT}")

# ── REBUILD INDEX ────────────────────────────────────────────────────────────
print("\nRebuilding embeddings and FAISS index...")

def clean_emb(t):
    t = (t or "").lower()
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

texts   = [f"{p.get('title','')}. {p.get('abstract','')}" for p in kept]
cleaned = [clean_emb(t) for t in texts]

t0 = time.time()
with open(DATA / "embedder.pkl", "rb") as f:
    state = pickle.load(f)
vec = state["vectorizer"]
svd = state["svd"]

mat  = vec.transform(cleaned)
red  = svd.transform(mat)
embs = normalize(red).astype("float32")
print(f"  Embeddings: {embs.shape} in {time.time()-t0:.1f}s")

index = faiss.IndexFlatIP(embs.shape[1])
index.add(embs)
faiss.write_index(index, str(DATA / "faiss.index"))
np.save(DATA / "embeddings.npy", embs)

# Update metadata parquet
meta = pd.DataFrame([{
    "row_id": i, "paper_id": p.get("paper_id"), "title": p.get("title"),
    "abstract": p.get("abstract"), "year": p.get("year"), "venue": p.get("venue"),
    "citations": p.get("citations"), "quartile": p.get("quartile"),
    "approx_quartile": p.get("approx_quartile"),
    "sjr_score": p.get("sjr_score"), "h_index": p.get("h_index"),
} for i, p in enumerate(kept)])
meta.to_parquet(DATA / "metadata.parquet")

print(f"\nDone. Restart uvicorn to pick up the new index.")
print(f"Papers before: {len(papers):,}  |  After: {len(kept):,}  |  Removed: {len(removed):,}")
