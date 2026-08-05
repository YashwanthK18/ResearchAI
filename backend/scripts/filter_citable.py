"""
filter_citable.py
=================
Keeps only papers that are genuinely useful for students to cite in
a project — primary research papers with sufficient impact.

Removes:
  1. Survey / review / meta-analysis / tutorial / overview papers
     (these are useful for reading but not for citing as primary sources)
  2. Editorial, commentary, correction, retraction, preface, keynote papers
  3. Papers with very short abstracts (< 80 chars — usually incomplete records)
  4. Non-English titles (3+ consecutive non-ASCII characters in title)
  5. Low-citation papers relative to their age:
       - 0-1 years old : need 2+ citations
       - 1-3 years old : need 5+ citations
       - 3-6 years old : need 15+ citations
       - 6+ years old  : need 30+ citations
     This removes genuinely low-impact / low-quality papers while keeping
     legitimate recent papers that haven't had time to accumulate citations.

Run from backend/ folder:
    python scripts/filter_citable.py
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
BACKUP = DATA / "cse_papers_with_quartiles_prefilt.jsonl"
CURRENT_YEAR = 2025

# ── FILTER PATTERNS ──────────────────────────────────────────────────────────

NOT_CITABLE = re.compile(
    r'\b('
    # Meta-papers about other papers
    r'survey|surveys|review|reviews|overview|overviews|'
    r'systematic review|literature review|scoping review|narrative review|'
    r'comprehensive review|brief review|short review|mini.?review|'
    r'state of the art|state-of-the-art|'
    r'recent advances|recent progress|recent developments|recent trends|'
    r'meta.?analysi[s]?|meta analysi[s]?|'
    # Instructional / introductory
    r'tutorial|tutorials|primer|introduction to|a gentle introduction|'
    r'beginners? guide|getting started|hands.on|'
    # Non-research content
    r'editorial|commentary|commentaries|opinion|letter to the editor|'
    r'correspondence|response to|reply to|'
    r'erratum|corrigendum|retraction|correction notice|'
    r'preface|foreword|special issue|call for papers|'
    r'workshop report|conference report|workshop summary|'
    r'invited talk|keynote address|panel discussion|'
    r'roadmap|taxonomy|'
    # Perspective / opinion pieces
    r'perspectives? on|viewpoint|position paper'
    r')\b',
    re.IGNORECASE
)

NON_ENGLISH = re.compile(r'[^\x00-\x7F]{3,}')

def min_citations(year):
    age = max(1, CURRENT_YEAR - (year or CURRENT_YEAR))
    if age <= 1:  return 2
    if age <= 3:  return 5
    if age <= 6:  return 15
    return 30

def removal_reason(p):
    title     = p.get("title", "") or ""
    abstract  = p.get("abstract", "") or ""
    year      = p.get("year") or CURRENT_YEAR
    citations = p.get("citations", 0) or 0

    if NOT_CITABLE.search(title):
        return "survey/review/editorial/tutorial"
    if NON_ENGLISH.search(title):
        return "non-english title"
    if len(abstract.strip()) < 80:
        return "abstract too short"
    if citations < min_citations(year):
        return f"low citations for age ({citations} cites, year {year}, need {min_citations(year)})"
    return None  # keep

# ── RUN ──────────────────────────────────────────────────────────────────────

print("Loading papers...")
papers = []
with open(INPUT, encoding="utf-8") as f:
    for line in f:
        try: papers.append(json.loads(line))
        except: pass
print(f"  Loaded: {len(papers):,}")

kept, removed = [], []
reason_counts = Counter()

for p in papers:
    reason = removal_reason(p)
    if reason:
        removed.append(p)
        reason_counts[reason.split("(")[0].strip()] += 1
    else:
        kept.append(p)

print(f"\n  Will KEEP:   {len(kept):,}")
print(f"  Will REMOVE: {len(removed):,}")
print("\nRemoval breakdown:")
for reason, count in reason_counts.most_common():
    print(f"  {count:6,}  {reason}")

print("\nSample removed titles (survey/review):")
samples = [p["title"] for p in removed if NOT_CITABLE.search(p.get("title",""))][:8]
for t in samples:
    print(f"  - {t[:85]}")

confirm = input(f"\nProceed? Keep {len(kept):,} citable papers, remove {len(removed):,}. (yes/no): ").strip().lower()
if confirm != "yes":
    print("Aborted."); sys.exit(0)

# ── SAVE ─────────────────────────────────────────────────────────────────────
shutil.copy(INPUT, BACKUP)
print(f"Backup: {BACKUP}")

with open(INPUT, "w", encoding="utf-8") as f:
    for p in kept:
        f.write(json.dumps(p, ensure_ascii=False) + "\n")
print(f"Filtered dataset saved.")

# ── REBUILD INDEX ─────────────────────────────────────────────────────────────
print("\nRebuilding embeddings and FAISS index...")

def clean_emb(t):
    t = (t or "").lower()
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

texts   = [f"{p.get('title','')}. {p.get('abstract','')}" for p in kept]
cleaned = [clean_emb(t) for t in texts]

with open(DATA / "embedder.pkl", "rb") as f:
    state = pickle.load(f)

t0  = time.time()
mat  = state["vectorizer"].transform(cleaned)
red  = state["svd"].transform(mat)
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

print(f"\nDone.")
print(f"  Before: {len(papers):,} papers")
print(f"  After:  {len(kept):,} papers")
print(f"  Removed:{len(removed):,} papers")
print(f"\nRestart uvicorn to pick up the new index.")
