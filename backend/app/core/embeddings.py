"""
embeddings.py
=============
Sentence-BERT based embedder (replaces the earlier TF-IDF+SVD approach).

Uses `sentence-transformers/all-MiniLM-L6-v2` — 384-dim, fast on CPU,
strong general-purpose semantic quality, and a common default choice
for academic-search projects.

Unlike the old TfidfSvdEmbedder, this class holds no fitted state of
its own — the model is pretrained, so there's nothing to "fit" on your
corpus. `load()`/`save()` just persist the model name so the rest of
the codebase can load an embedder the same way regardless of type.
"""
from pathlib import Path
import pickle
from sentence_transformers import SentenceTransformer

MODEL_NAME    = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


class SentenceBertEmbedder:
    def __init__(self, model_name: str = MODEL_NAME):
        self.model_name = model_name
        self.n_components = EMBEDDING_DIM
        self._model = None  # lazy-loaded

    @property
    def model(self):
        if self._model is None:
            self._model = SentenceTransformer(self.model_name)
        return self._model

    def fit_transform(self, texts):
        """No fitting needed for a pretrained model — just encode."""
        return self.transform(texts)

    def transform(self, texts):
        embs = self.model.encode(
            list(texts),
            batch_size=64,
            show_progress_bar=len(texts) > 500,
            convert_to_numpy=True,
            normalize_embeddings=True,  # so FAISS inner product == cosine similarity
        )
        return embs.astype("float32")

    def save(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"model_name": self.model_name, "n_components": self.n_components}, f)

    @classmethod
    def load(cls, path):
        with open(path, "rb") as f:
            state = pickle.load(f)
        return cls(model_name=state.get("model_name", MODEL_NAME))


# Backwards-compatible alias — search_engine.py imports this name.
# NOTE: old TF-IDF+SVD embedder.pkl / embeddings.npy / faiss.index files are
# NOT compatible with this class. You must re-run run_pipeline.py to rebuild
# them after switching embedders.
TfidfSvdEmbedder = SentenceBertEmbedder
