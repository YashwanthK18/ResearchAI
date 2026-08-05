const API = import.meta.env.VITE_API_BASE || '/api';

async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      let msg = `Server error ${res.status}`;
      try { const b = await res.json(); msg = b.detail || b.message || msg; } catch {}
      throw new Error(String(msg));
    }
    try { return await res.json(); }
    catch { throw new Error(`Cannot parse server response. Is uvicorn running?`); }
  } catch(e) {
    if (e.message && e.message !== 'undefined') throw e;
    throw new Error(`Cannot reach backend. Is uvicorn running on port 8000?`);
  }
}

export const searchPapers       = (q)              => apiFetch(`${API}/search`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(q) });
export const searchByPdf        = (file, k=10)     => { const fd=new FormData(); fd.append('file',file); return apiFetch(`${API}/search/pdf?top_k=${k}`,{method:'POST',body:fd}); };
export const fetchSimilar       = (id, k=8)        => apiFetch(`${API}/similar/${id}?top_k=${k}`);
export const fetchTrend         = (q, n=1200, s=false)     => apiFetch(`${API}/trend?query=${encodeURIComponent(q)}&pool_size=${n}&scimago_only=${s}`);
export const fetchEvolution     = (q, n=800, s=false)      => apiFetch(`${API}/evolution?query=${encodeURIComponent(q)}&pool_size=${n}&scimago_only=${s}`);
export const fetchCluster       = (q, n=500, k=5, s=false) => apiFetch(`${API}/cluster?query=${encodeURIComponent(q)}&pool_size=${n}&n_clusters=${k}&scimago_only=${s}`);
export const fetchDuplicates    = (q, n=300, t=.85)=> apiFetch(`${API}/duplicates?query=${encodeURIComponent(q)}&pool_size=${n}&threshold=${t}`);
export const fetchStats         = ()               => apiFetch(`${API}/stats`);
export const fetchGap           = (q, n=1500, s=false)     => apiFetch(`${API}/gap?query=${encodeURIComponent(q)}&pool_size=${n}&scimago_only=${s}`);
export const fetchSummary       = (q, n=50, s=false)       => apiFetch(`${API}/summary?query=${encodeURIComponent(q)}&pool_size=${n}&scimago_only=${s}`);
export const fetchCheckDuplicate= (text,k=15,t=.75)=> apiFetch(`${API}/check_duplicate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,top_k:k,threshold:t})});
