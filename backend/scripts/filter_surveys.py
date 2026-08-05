"""
filter_surveys.py
=================
Removes survey, review, tutorial, and overview papers from the dataset,
then rebuilds the FAISS index. Run from backend/ folder:
    python scripts/filter_surveys.py
"""
import json, re, shutil, sys, time, pickle
from pathlib import Path
from collections import Counter
import numpy as np
import faiss
import pandas as pd
from sklearn.preprocessing import normalize

BASE   = Path(__file__).resolve().parents[1]
DATA   = BASE / "data"
INPUT  = DATA / "cse_papers_with_quartiles.jsonl"
BACKUP = DATA / "cse_papers_with_quartiles_presurvey.jsonl"

# Title patterns that indicate a survey/review/tutorial — not original research
SURVEY_PATTERNS = re.compile(
    r'\b(survey|surveys|review|reviews|overview|overviews|tutorial|tutorials|'
    r'systematic review|literature review|state of the art|state-of-the-art|'
    r'comprehensive review|recent advances|recent progress|recent developments|'
    r'brief review|short review|scoping review|narrative review|'
    r'taxonomy|roadmap|primer|retrospective|perspective on|perspectives on)\b',
    re.IGNORECASE
)

def is_survey(paper):
    title = paper.get("title", "") or ""
    return bool(SURVEY_PATTERNS.search(title))

print("Loading papers...")
papers = []
with open(INPUT, encoding="utf-8") as f:
    for line in f:
        try: papers.append(json.loads(line))
        except: pass
print(f"  Loaded: {len(papers):,}")

kept, removed = [], []
survey_titles = Counter()
for p in papers:
    if is_survey(p):
        removed.append(p)
        survey_titles[p.get("title","")] += 1
    else:
        kept.append(p)

print(f"  Kept:    {len(kept):,}")
print(f"  Surveys removed: {len(removed):,}")
print("\nSample removed titles:")
for t in list(survey_titles)[:10]:
    print(f"  - {t[:80]}")

confirm = input(f"\nRemove {len(removed):,} survey papers and rebuild index? (yes/no): ").strip().lower()
if confirm != "yes":
    print("Aborted."); sys.exit(0)

shutil.copy(INPUT, BACKUP)
print(f"Backup: {BACKUP}")

with open(INPUT, "w", encoding="utf-8") as f:
    for p in kept:
        f.write(json.dumps(p, ensure_ascii=False) + "\n")

print("Rebuilding embeddings...")
def clean_emb(t):
    t = (t or "").lower()
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

texts   = [f"{p.get('title','')}. {p.get('abstract','')}" for p in kept]
cleaned = [clean_emb(t) for t in texts]

with open(DATA / "embedder.pkl", "rb") as f:
    state = pickle.load(f)
vec = state["vectorizer"]
svd = state["svd"]

t0  = time.time()
mat  = vec.transform(cleaned)
red  = svd.transform(mat)
embs = normalize(red).astype("float32")
print(f"  Embeddings: {embs.shape} in {time.time()-t0:.1f}s")

index = faiss.IndexFlatIP(embs.shape[1])
index.add(embs)
faiss.write_index(index, str(DATA / "faiss.index"))
np.save(DATA / "embeddings.npy", embs)

meta = pd.DataFrame([{
    "row_id": i, "paper_id": p.get("paper_id"), "title": p.get("title"),
    "abstract": p.get("abstract"), "year": p.get("year"), "venue": p.get("venue"),
    "citations": p.get("citations"), "quartile": p.get("quartile"),
    "approx_quartile": p.get("approx_quartile"),
    "sjr_score": p.get("sjr_score"), "h_index": p.get("h_index"),
} for i, p in enumerate(kept)])
meta.to_parquet(DATA / "metadata.parquet")

print(f"\nDone. Papers before: {len(papers):,} → after: {len(kept):,}")
print("Restart uvicorn to pick up the new index.")
