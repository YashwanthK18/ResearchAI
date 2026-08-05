import { useEffect, useState } from 'react';
import { X, Loader2, ExternalLink } from 'lucide-react';
import { fetchSimilar } from '../lib/api';
import QBadge from './QBadge';

export default function SimilarModal({ paper, onClose }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!paper?.paper_id) return;
    fetchSimilar(paper.paper_id, 8)
      .then(d => setResults(d.results))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [paper?.paper_id]);

  function googleSearch(title) {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(title + ' research paper')}`, '_blank');
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h3>Similar Papers</h3>
            <p style={{fontSize:12,color:'var(--tx3)',marginTop:3}}>
              Semantically similar to: <em style={{color:'var(--tx2)'}}>{paper.title?.slice(0,70)}…</em>
            </p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={20}/></button>
        </div>

        <div className="modal-body">
          {loading && <div className="loading"><Loader2 size={18} className="spin"/> Finding similar papers…</div>}
          {error   && <p className="err">{error}</p>}
          {!loading && results.map((r, i) => (
            <div key={r.paper_id || i} className="sim-card">
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:6}}>
                <QBadge quartile={r.quartile} approxQuartile={r.approx_quartile} isApprox={r.is_approx}/>
                <span className="sim-badge">{(r.similarity*100).toFixed(1)}%</span>
              </div>
              <div className="sim-title">
                <a href={`https://www.google.com/search?q=${encodeURIComponent((r.title||'')+' research paper')}`}
                   target="_blank" rel="noreferrer" title="Search on Google Scholar">
                  {r.title}
                </a>
              </div>
              <div className="sim-meta">
                <span>{r.venue}{r.year ? `, ${r.year}` : ''}</span>
                {r.citations != null && <span>{r.citations.toLocaleString()} citations</span>}
              </div>
            </div>
          ))}
          {!loading && results.length === 0 && !error &&
            <p className="empty">No similar papers found.</p>}
        </div>
      </div>
    </div>
  );
}
