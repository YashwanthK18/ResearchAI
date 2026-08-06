#!/bin/bash
set -e

echo "Creating data directory..."
mkdir -p data

echo "Installing gdown..."
pip install gdown -q

echo "Downloading embedder.pkl..."
gdown 1JlfVg5LnSLmm-cI6YxbbVFR8as902v7x -O data/embedder.pkl

echo "Downloading metadata.parquet..."
gdown 1Q1e9NBJkf9jCcWBDBvGKfOOkU-euAkhe -O data/metadata.parquet

echo "Downloading faiss.index..."
gdown 1Tywaykgvh7n4iGpiChxBXv6XMES8qkeS -O data/faiss.index

echo "Downloading embeddings.npy..."
gdown 1PbiqclSZMKYinDYmRmfgWRFFMSZppyvi -O data/embeddings.npy

echo "Pre-downloading Sentence-BERT model so startup is fast..."
python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2'); print('SBERT model cached.')"

echo "All data files downloaded successfully!"
ls -lh data/