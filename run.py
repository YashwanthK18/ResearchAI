import subprocess
import time
import webbrowser
import sys
import os
import urllib.request
import urllib.error

# --- CONFIGURATION ---
BACKEND_DIR   = "backend"
FRONTEND_DIR  = "frontend"
FRONTEND_URL  = "http://localhost:5173"
BACKEND_URL   = "http://localhost:8000/api/health"
MAX_WAIT_SECS = 60   # how long to wait for backend before giving up
# ---------------------

def wait_for_backend(max_seconds=MAX_WAIT_SECS):
    """Poll the backend health endpoint until it responds or we time out."""
    print(f"⏳ Waiting for backend to be ready (up to {max_seconds}s)...")
    start = time.time()
    while time.time() - start < max_seconds:
        try:
            with urllib.request.urlopen(BACKEND_URL, timeout=2) as r:
                if r.status == 200:
                    elapsed = round(time.time() - start, 1)
                    print(f"✅ Backend ready after {elapsed}s")
                    return True
        except Exception:
            pass
        time.sleep(1.5)
    print("⚠️  Backend did not respond in time — frontend will start anyway.")
    return False

def run_development_servers():
    processes = []
    try:
        print("🚀 Starting ResearchAI backend and frontend...")

        # 1. Start backend
        backend_path = os.path.abspath(BACKEND_DIR)
        print(f"📦 Launching backend in: {backend_path}")
        backend_cmd = [
            sys.executable, "-m", "uvicorn", "app.main:app",
            "--host", "0.0.0.0", "--port", "8000"
        ]
        backend_process = subprocess.Popen(backend_cmd, cwd=backend_path)
        processes.append(backend_process)

        # 2. Wait until backend is actually ready (not just started)
        #    This handles the FAISS index + embedder load time for 165k papers
        wait_for_backend()

        # 3. Start frontend
        frontend_path = os.path.abspath(FRONTEND_DIR)
        print(f"📦 Launching frontend in: {frontend_path}")
        use_shell = os.name == 'nt'
        frontend_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=frontend_path,
            shell=use_shell
        )
        processes.append(frontend_process)

        # 4. Wait for Vite to compile (usually 5-8 seconds)
        print("⏳ Waiting 10 seconds for Vite compilation...")
        time.sleep(10)

        # 5. Open browser
        print(f"🌐 Opening {FRONTEND_URL} in your browser...")
        webbrowser.open(FRONTEND_URL)

        print("\n🔥 Both servers running. Press Ctrl+C to stop.\n")
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n🛑 Stopping servers...")
    finally:
        for proc in processes:
            if proc.poll() is None:
                proc.terminate()
        print("✅ Servers shut down.")

if __name__ == "__main__":
    run_development_servers()
