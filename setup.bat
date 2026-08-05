@echo off
echo Installing backend dependencies...
pip install fastapi "uvicorn[standard]" pydantic python-multipart faiss-cpu scikit-learn PyMuPDF numpy pandas pyarrow rapidfuzz recharts
echo Done. Now run: run.bat
