"""
slim_metadata.py
================
Reduces metadata.parquet to only the columns actually needed at runtime,
significantly cutting RAM usage on the server.

Run from backend/:
    python slim_metadata.py

Then re-upload the new data/metadata.parquet to Google Drive.
"""
import pandas as pd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"

print("Loading metadata.parquet...")
meta = pd.read_parquet(DATA / "metadata.parquet")
print(f"Original shape: {meta.shape}")
print(f"Original columns: {meta.columns.tolist()}")
print(f"Original size: {(DATA / 'metadata.parquet').stat().st_size / 1e6:.1f} MB")

# Only keep columns actually used at runtime
KEEP = [
    "row_id", "paper_id", "title", "abstract",
    "year", "venue", "citations",
    "quartile", "approx_quartile",
    "sjr_score", "h_index",
]

# Only keep columns that exist
keep = [c for c in KEEP if c in meta.columns]
missing = [c for c in KEEP if c not in meta.columns]
if missing:
    print(f"Warning: these columns not found (skipping): {missing}")

meta_slim = meta[keep].copy()

# Downcast numeric types to save more RAM
if "year" in meta_slim.columns:
    meta_slim["year"] = pd.to_numeric(meta_slim["year"], errors="coerce").astype("Int16")
if "citations" in meta_slim.columns:
    meta_slim["citations"] = pd.to_numeric(meta_slim["citations"], errors="coerce").astype("Int32")
if "row_id" in meta_slim.columns:
    meta_slim["row_id"] = pd.to_numeric(meta_slim["row_id"], errors="coerce").astype("Int32")
if "h_index" in meta_slim.columns:
    meta_slim["h_index"] = pd.to_numeric(meta_slim["h_index"], errors="coerce").astype("Int16")
if "sjr_score" in meta_slim.columns:
    meta_slim["sjr_score"] = pd.to_numeric(meta_slim["sjr_score"], errors="coerce").astype("float32")

# Save
out = DATA / "metadata.parquet"
meta_slim.to_parquet(out, compression="snappy", index=False)
size_mb = out.stat().st_size / 1e6
print(f"\nSlimmed shape: {meta_slim.shape}")
print(f"Slimmed columns: {meta_slim.columns.tolist()}")
print(f"New size: {size_mb:.1f} MB")
print(f"\nSaved to {out}")
print("\nNow re-upload data/metadata.parquet to Google Drive and redeploy.")
