# How to reindex with all 165k papers

The zip ships with a 62k-paper index built in the sandbox (the full file was too large to upload there).
To get all 165k papers indexed locally:

## Step 1 — Place your full papers file
Copy your `cse_papers.jsonl` (165k papers, ~592MB) to:
```
backend\data\raw\cse_papers.jsonl
```

## Step 2 — Run the pipeline (from backend\ folder)
```powershell
python run_pipeline.py
```
This runs all 5 steps automatically:
1. SCImago quartile matching (all years 2000-2025)
2. Approximate quartile estimation for unmatched papers
3. TF-IDF + SVD embeddings
4. FAISS index build
5. Metadata table

Expected time: **5–15 minutes** depending on your machine (the SVD step on 165k papers takes most of that).

## Step 3 — Restart the backend
```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
The catalog page should now show ~165k papers.
