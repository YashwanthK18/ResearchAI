# AI-Based Semantic Research Paper Discovery & Analytics

A full-stack semantic search and analytics web application for Computer Science research papers, built as an academic project at Bangalore Institute of Technology.

## Features
- **Semantic Search** — Find papers by meaning, not just keywords (Sentence-BERT)
- **Research Intelligence** — Publication trends, topic evolution, and research gap analysis
- **Topic Clusters** — K-Means clustering with 2D PCA visualization
- **Topic Summary** — Overview of a research area with active venues and key terms
- **Check My Work** — Duplicate and plagiarism detection against the corpus
- **SCImago Integration** — Journal quartile rankings (Q1–Q4) for 99k+ papers
- **Save & Export** — Save papers, export as CSV or BibTeX, quick cite

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React.js, Recharts, Lucide Icons, Vite |
| Backend | FastAPI, Python 3.12 |
| Embeddings | Sentence-BERT (all-MiniLM-L6-v2, 384-dim) |
| Vector Search | FAISS (IndexFlatIP, cosine similarity) |
| Clustering | scikit-learn (K-Means + PCA) |
| Journal Ranking | SCImago + RapidFuzz fuzzy matching |
| Data Source | Semantic Scholar API (~99,075 CS papers) |

## Project Structure
```
project/
  backend/
    app/           # FastAPI application (routes, search engine, embedder)
    data/          # Data files (not in repo — see Setup)
    scripts/       # Data pipeline and preprocessing scripts
    requirements.txt
  frontend/
    src/           # React components and lib
    public/
  README.md
  .gitignore
```

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- `cse_papers_with_quartiles.jsonl` (enriched dataset — not in repo due to size)

### Backend
```bash
cd backend
pip install -r requirements.txt

# Place cse_papers_with_quartiles.jsonl in backend/data/
# Then rebuild the SBERT embeddings and FAISS index:
python scripts/rebuild_embeddings.py

# Start the API server:
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

## Data Files
Large data files are excluded from this repository (GitHub 100MB limit):

| File | Size | Description |
|---|---|---|
| `embeddings.npy` | ~145MB | SBERT embedding matrix (99k × 384) |
| `faiss.index` | ~145MB | FAISS vector index |
| `metadata.parquet` | ~90MB | Paper metadata |
| `cse_papers_with_quartiles.jsonl` | ~340MB | Enriched paper corpus |

Run `python scripts/rebuild_embeddings.py` after placing the enriched JSONL in `backend/data/` to regenerate the index files.

## Academic Context
Developed as a major project for the Department of Computer Science & Engineering,
Bangalore Institute of Technology, Bengaluru — 560004.
