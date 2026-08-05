import { useState } from 'react';
import { Search, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchCluster } from '../lib/api';
import { sortPapers } from '../lib/sort';
import QBadge from './QBadge';
import SortSelect from './SortSelect';
import CenteredSearch from './CenteredSearch';
import ScimagoToggle from './ScimagoToggle';

const PAL = ['#4f6ef7','#16a34a','#ea580c','#9333ea','#0891b2','#dc2626','#ca8a04','#db2777','#0d9488'];
const EXAMPLES = ['machine learning', 'computer vision', 'cybersecurity', 'cloud computing'];

export default function ClusterPanel({ sharedQuery }) {
  const [query,    setQuery]    = useState(sharedQuery || '');
  const [data,     setData]     = useState(null);
  const [load,     setLoad]     = useState(false);
  const [err,      setErr]      = useState(null);
  const [nc,       setNc]       = useState(5);
  const [hovered,  setHovered]  = useState(null);
  const [selClust, setSelClust] = useState(null);
  const [open,     setOpen]     = useState({});
  const [scimagoOnly, setScimagoOnly] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');

  async function run(e) {
    e?.preventDefault(); if (!query.trim()) return;
    setLoad(true); setErr(null); setData(null); setOpen({}); setSelClust(null);
    try { setData(await fetchCluster(query, 400, nc, scimagoOnly)); }
    catch(e) {
      const m = e.message || '';
      setErr(m.includes('500') || m.includes('Clustering failed')
        ? `Not enough papers for "${query}" with ${nc} clusters. Try a broader topic or fewer clusters.`
        : m);
    }
    finally { setLoad(false); }
  }

  async function handleToggle(val) {
    setScimagoOnly(val);
    if (data) {
      setLoad(true); setErr(null); setOpen({}); setSelClust(null);
      try { setData(await fetchCluster(query, 400, nc, val)); }
      catch(e) { setErr(e.message); }
      finally { setLoad(false); }
    }
  }

  function norm(pts) {
    if (!pts.length) return [];
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    const rx = x1-x0||1, ry = y1-y0||1;
    return pts.map(p => ({ ...p, nx: 5+((p.x-x0)/rx)*90, ny: 5+((p.y-y0)/ry)*90 }));
  }

  const pts = data ? norm(data.points) : [];
  const clusters = data ? Object.entries(data.cluster_labels).map(([cid, terms]) => ({
    id: +cid, terms,
    papers: sortPapers(pts.filter(p => p.cluster === +cid).sort((a,b) => (b.similarity||0)-(a.similarity||0)), sortBy),
    color: PAL[+cid % PAL.length],
  })).sort((a,b) => b.papers.length - a.papers.length) : [];

  const activeClusters = selClust !== null ? clusters.filter(c => c.id === selClust) : clusters;

  if (!data && !load && !err) {
    return (
      <CenteredSearch
        icon="🗂️"
        title="Topic Clusters"
        subtitle="Automatically group papers into research sub-topics — great for understanding the landscape of a field and finding which area to focus your project on"
        placeholder='e.g. "machine learning" or "computer vision"'
        examples={EXAMPLES}
        value={query}
        onChange={setQuery}
        onSubmit={run}
        loading={load}
        buttonLabel="Cluster Papers"
        accentColor="#0891b2"
        extra={
          <select value={nc} onChange={e => setNc(+e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--tx2)', cursor: 'pointer', padding: '0 4px' }}>
            {[3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} clusters</option>)}
          </select>
        }
        filter={<ScimagoToggle value={scimagoOnly} onChange={setScimagoOnly}/>}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div className="ph" style={{marginBottom:0}}>
          <h2>Topic Clusters</h2>
          <p>Papers grouped into research sub-topics — click dots or cards to explore each cluster</p>
        </div>
        <ScimagoToggle value={scimagoOnly} onChange={handleToggle}/>
      </div>

      <form onSubmit={run} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <div className="sbar" style={{ flex: 1 }}>
          <Search size={15} className="sbar-ico"/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a topic..."/>
        </div>
        <select value={nc} onChange={e => setNc(+e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid var(--bd)', borderRadius: 'var(--rs)', fontSize: 13, background: 'var(--surf)' }}>
          {[3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} clusters</option>)}
        </select>
        <button className="btn btn-acc" style={{ background: '#0891b2' }} disabled={load}>
          {load ? <Loader2 size={14} className="spin"/> : 'Cluster'}
        </button>
      </form>

      {err  && <p className="err">{err}</p>}
      {load && <div className="loading"><Loader2 size={18} className="spin"/>Clustering papers into topic groups…</div>}

      {data && !load && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

          {/* LEFT: Scatter plot */}
          <div style={{ background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {data.points.length} papers · 2D projection (PCA)
                {scimagoOnly && <span style={{fontSize:11,background:'#dcfce7',color:'#15803d',padding:'2px 8px',borderRadius:20,fontWeight:600}}>SCImago only</span>}
              </span>
              {selClust !== null && (
                <button onClick={() => setSelClust(null)}
                  style={{ fontSize: 12, color: 'var(--acc)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  ✕ Clear selection
                </button>
              )}
            </div>

            <div style={{ position: 'relative', height: 380, background: '#f8faff', margin: 12, borderRadius: 8, border: '1px solid var(--bd)', overflow: 'hidden' }}
              onMouseLeave={() => setHovered(null)}>
              {pts.map((p, i) => {
                const color = PAL[p.cluster % PAL.length];
                const isHov = hovered === p.cluster;
                const isSel = selClust === p.cluster;
                const isDim = selClust !== null && selClust !== p.cluster;
                return (
                  <div key={i}
                    style={{
                      position: 'absolute', left: `${p.nx}%`, top: `${p.ny}%`,
                      width: isSel||isHov ? 13 : 8, height: isSel||isHov ? 13 : 8,
                      borderRadius: '50%', background: color,
                      transform: 'translate(-50%,-50%)',
                      opacity: isDim ? 0.12 : 0.85,
                      cursor: 'pointer', zIndex: isDim ? 0 : 2,
                      transition: 'all .13s',
                      boxShadow: isSel ? `0 0 0 3px ${color}44` : isHov ? `0 0 0 2px ${color}66` : 'none',
                    }}
                    title={p.title}
                    onMouseEnter={() => setHovered(p.cluster)}
                    onClick={() => setSelClust(selClust === p.cluster ? null : p.cluster)}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ padding: '10px 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {clusters.map(cl => (
                <button key={cl.id}
                  onClick={() => setSelClust(selClust === cl.id ? null : cl.id)}
                  onMouseEnter={() => setHovered(cl.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 20,
                    border: `1.5px solid ${selClust === cl.id ? cl.color : 'var(--bd)'}`,
                    background: selClust === cl.id ? cl.color+'18' : 'var(--bg)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    color: selClust === cl.id ? cl.color : 'var(--tx2)',
                    opacity: selClust !== null && selClust !== cl.id ? 0.4 : 1,
                    transition: 'all .13s',
                  }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cl.color, flexShrink: 0 }}/>
                  Cluster {cl.id+1} ({cl.papers.length})
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: Topic cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 580, overflowY: 'auto', paddingRight: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <SortSelect value={sortBy} onChange={setSortBy}/>
            </div>
            {activeClusters.map(cl => {
              const isOpen = open[cl.id];
              const preview = cl.papers.slice(0, 3);
              const rest    = cl.papers.slice(3);
              return (
                <div key={cl.id}
                  style={{ background: 'var(--surf)', border: `1px solid var(--bd)`, borderLeft: `4px solid ${cl.color}`, borderRadius: 'var(--r)', overflow: 'hidden', transition: 'box-shadow .13s', boxShadow: selClust === cl.id ? '0 4px 16px rgba(0,0,0,.1)' : 'var(--shs)' }}
                  onMouseEnter={() => setHovered(cl.id)}
                  onMouseLeave={() => setHovered(null)}>

                  {/* Cluster header */}
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                    onClick={() => setSelClust(selClust === cl.id ? null : cl.id)}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: cl.color+'22', border: `2px solid ${cl.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: cl.color }}>{cl.id+1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>{cl.papers.length} papers</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {cl.terms.slice(0, 4).map(k => (
                          <span key={k} style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: cl.color+'18', color: cl.color }}>{k}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Papers */}
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {preview.map((p, i) => <MiniPaper key={p.paper_id||i} paper={p} color={cl.color}/>)}
                    {rest.length > 0 && (
                      <>
                        {isOpen && rest.map((p, i) => <MiniPaper key={p.paper_id||i} paper={p} color={cl.color}/>)}
                        <button onClick={() => setOpen(o => ({ ...o, [cl.id]: !o[cl.id] }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--acc)', fontSize: 11, fontWeight: 600, padding: '4px 2px', cursor: 'pointer' }}>
                          {isOpen ? <><ChevronUp size={11}/>Show fewer</> : <><ChevronDown size={11}/>+{rest.length} more</>}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniPaper({ paper, color }) {
  const q = paper.quartile || 'Unknown';
  const aq = paper.approx_quartile;
  return (
    <div style={{ display: 'flex', gap: 7, padding: '7px 8px', background: 'var(--bg)', borderRadius: 'var(--rs)', border: '1px solid var(--bd)' }}>
      <div style={{ width: 3, flexShrink: 0, alignSelf: 'stretch', background: color, borderRadius: 2 }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={`https://www.google.com/search?q=${encodeURIComponent((paper.title||'')+' research paper')}`}
          target="_blank" rel="noreferrer"
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', textDecoration: 'none', display: 'block', lineHeight: 1.4, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={paper.title}>
          {paper.title}
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <QBadge quartile={q} approxQuartile={aq} isApprox={q==='Unknown'&&!!aq}/>
          {paper.year && <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{paper.year}</span>}
        </div>
      </div>
    </div>
  );
}
