"""
rebuild_embeddings.py
======================
Faster than run_pipeline.py — use this if you already have
data/cse_papers_with_quartiles.jsonl (SCImago matching already done)
and only need to switch embedders (e.g. TF-IDF+SVD -> Sentence-BERT).

Regenerates: embedder.pkl, embeddings.npy, faiss.index, metadata.parquet

Run from backend/:
    pip install sentence-transformers
    python rebuild_embeddings.py
"""
import json, pickle, time
from pathlib import Path

import numpy as np
import pandas as pd
import faiss
from sentence_transformers import SentenceTransformer

BASE = Path(__file__).resolve().parents[1]
DATA = BASE / "data"

ENRICHED_FILE  = DATA / "cse_papers_with_quartiles.jsonl"
FAISS_INDEX    = DATA / "faiss.index"
EMBEDDER_FILE  = DATA / "embedder.pkl"
META_FILE      = DATA / "metadata.parquet"
EMBEDDINGS_FILE= DATA / "embeddings.npy"
MODEL_NAME     = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM  = 384

print(f"Loading {ENRICHED_FILE} ...")
papers = []
with open(ENRICHED_FILE, encoding="utf-8") as f:
    for i, line in enumerate(f):
        try: papers.append(json.loads(line))
        except: pass
        if (i+1) % 20000 == 0: print(f"  loaded {i+1:,}")
print(f"Total: {len(papers):,}")

print(f"\nEmbedding with {MODEL_NAME} (dim={EMBEDDING_DIM})...")
texts = [f"{p.get('title','')}. {p.get('abstract','')}" for p in papers]

t0 = time.time()
model = SentenceTransformer(MODEL_NAME)
embs  = model.encode(
    texts,
    batch_size=64,
    show_progress_bar=True,
    convert_to_numpy=True,
    normalize_embeddings=True,
).astype("float32")
print(f"Shape: {embs.shape} in {time.time()-t0:.1f}s")

with open(EMBEDDER_FILE, "wb") as f:
    pickle.dump({"model_name": MODEL_NAME, "n_components": EMBEDDING_DIM}, f)
np.save(EMBEDDINGS_FILE, embs)

print("\nBuilding FAISS index...")
index = faiss.IndexFlatIP(EMBEDDING_DIM)
index.add(embs)
faiss.write_index(index, str(FAISS_INDEX))
print(f"FAISS index: {index.ntotal:,} vectors")

print("\nRebuilding metadata.parquet...")
meta = pd.DataFrame([{
    "row_id": i, "paper_id": p.get("paper_id"), "title": p.get("title"),
    "abstract": p.get("abstract"), "year": p.get("year"), "venue": p.get("venue"),
    "citations": p.get("citations"), "quartile": p.get("quartile"),
    "approx_quartile": p.get("approx_quartile"),
    "sjr_score": p.get("sjr_score"), "h_index": p.get("h_index"),
} for i, p in enumerate(papers)])
meta.to_parquet(META_FILE)
print(f"Metadata: {len(meta):,} rows -> {META_FILE}")

print("\nDone. Restart uvicorn to pick up the new Sentence-BERT index.")
