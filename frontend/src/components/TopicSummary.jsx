import { useState } from 'react';
import { BookOpen, Loader2, ExternalLink, Search } from 'lucide-react';
import { fetchSummary } from '../lib/api';
import { sortPapers } from '../lib/sort';
import QBadge from './QBadge';
import SortSelect from './SortSelect';
import CenteredSearch from './CenteredSearch';
import ScimagoToggle from './ScimagoToggle';
import ApproxDisclaimer from './ApproxDisclaimer';

const EXAMPLES = ['transformer models','federated learning','object detection','graph neural networks'];

export default function TopicSummary({ sharedQuery }) {
  const [query,       setQuery]       = useState(sharedQuery||'');
  const [data,        setData]        = useState(null);
  const [load,        setLoad]        = useState(false);
  const [err,         setErr]         = useState(null);
  const [scimagoOnly, setScimagoOnly] = useState(false);
  const [sortBy,      setSortBy]      = useState('relevance');
  const [selVenue,    setSelVenue]    = useState(null);

  async function run(e) {
    e?.preventDefault(); if (!query.trim()) return;
    setLoad(true); setErr(null); setSelVenue(null);
    try { setData(await fetchSummary(query, 100)); }
    catch(e) { setErr(e.message||'Error'); }
    finally { setLoad(false); }
  }

  async function handleToggle(val) {
    setScimagoOnly(val); setSelVenue(null);
    if (data) {
      setLoad(true); setErr(null);
      try { setData(await fetchSummary(query, 100)); }
      catch(e) { setErr(e.message); }
      finally { setLoad(false); }
    }
  }

  const papers      = data?.all_papers || data?.top_papers || [];
  const shown       = scimagoOnly ? papers.filter(p=>p.quartile&&p.quartile!=='Unknown') : papers;
  const allShown    = shown;
  const venuePapers = selVenue ? allShown.filter(p => p.venue === selVenue) : null;
  const displayed   = venuePapers ?? shown;
  const approxCount = displayed.filter(p=>p.is_approx).length;

  if (!data && !load && !err) {
    return (
      <CenteredSearch
        icon="📚" title="Topic Summary"
        subtitle="Get a quick overview of any research field — key themes, top papers, active venues, narrative summary, and coverage span. Great starting point for a literature survey."
        placeholder='"transformer models" or "federated learning"'
        examples={EXAMPLES} value={query} onChange={setQuery}
        onSubmit={run} loading={load} buttonLabel="Summarize Topic" accentColor="#0d9488"
        filter={<ScimagoToggle value={scimagoOnly} onChange={setScimagoOnly}/>}
      />
    );
  }

  return (
    <div style={{maxWidth:960}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div className="ph" style={{marginBottom:0}}>
          <h2>Topic Summary</h2>
          <p>Overview of "{data?.query||query}" based on top 100 most relevant papers</p>
        </div>
        <ScimagoToggle value={scimagoOnly} onChange={handleToggle}/>
      </div>

      <form onSubmit={run} style={{display:'flex',gap:8,marginBottom:20}}>
        <div className="sbar" style={{flex:1}}>
          <Search size={15} className="sbar-ico"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search a topic..."/>
        </div>
        <button className="btn btn-acc" style={{background:'#0d9488'}} disabled={load}>
          {load?<Loader2 size={14} className="spin"/>:'Summarize'}
        </button>
      </form>

      {err  && <p className="err">{err}</p>}
      {load && <div className="loading"><Loader2 size={18} className="spin"/>Summarizing 100 papers on "{query}"…</div>}

      {data && !load && (
        <>
          {!scimagoOnly && approxCount>0 && <ApproxDisclaimer count={approxCount} total={displayed.length}/>}

          {/* Narrative summary */}
          <div style={{background:'linear-gradient(135deg,#0d948812,#0d948804)',border:'1px solid #0d948830',borderRadius:'var(--r)',padding:'18px 20px',marginBottom:20}}>
            <div style={{fontSize:12,fontWeight:700,color:'#0d9488',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>📝 Field Summary</div>
            <p style={{fontSize:14,color:'var(--tx)',lineHeight:1.7,margin:0}}>{data.narrative}</p>
          </div>

          {/* Stat cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
            <div className="stat-card"><div className="stat-num">{data.papers_analyzed}</div><div className="stat-lbl">Papers Analyzed</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:'#16a34a'}}>{data.q1_count}</div><div className="stat-lbl">Q1 Papers</div></div>
            <div className="stat-card"><div className="stat-num" style={{fontSize:18}}>{data.year_range?.min||'—'}</div><div className="stat-lbl">Earliest Year</div></div>
            <div className="stat-card"><div className="stat-num" style={{fontSize:18}}>{data.year_range?.max||'—'}</div><div className="stat-lbl">Latest Year</div></div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            {/* Key terms */}
            <div className="panel-card" style={{marginBottom:0}}>
              <h3><BookOpen size={15}/> Key Terms & Methods</h3>
              <p style={{fontSize:12,color:'var(--tx2)',marginBottom:12}}>Most frequent distinctive terms across {data.papers_analyzed} papers</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {(data.key_terms||[]).map((t,i)=>(
                  <span key={t} style={{padding:'5px 11px',borderRadius:20,fontSize:12,fontWeight:600,background:i<3?'#0d9488':i<7?'#0d948818':'var(--bg)',color:i<3?'#fff':'#0d9488',border:i<3?'none':'1px solid #0d948830'}}>{t}</span>
                ))}
                {(!data.key_terms||data.key_terms.length===0)&&<span style={{fontSize:12,color:'var(--tx3)'}}>No key terms extracted — try a more specific query</span>}
              </div>
            </div>

            {/* Active venues */}
            <div className="panel-card" style={{marginBottom:0}}>
              <h3>🏛️ Active Venues</h3>
              <p style={{fontSize:12,color:'var(--tx2)',marginBottom:12}}>Top journals and conferences</p>
              {(data.venues||[]).length===0&&<p style={{fontSize:12,color:'var(--tx3)'}}>No venue data available</p>}
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {(data.venues||[]).map((v,i)=>{
                  const name = v.name||v;
                  const active = selVenue === name;
                  return (
                    <button key={i} onClick={()=>setSelVenue(active ? null : name)}
                      style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:active?'#0d948818':'var(--bg)',borderRadius:'var(--rs)',border:active?'1.5px solid #0d9488':'1px solid var(--bd)',cursor:'pointer',textAlign:'left',width:'100%',font:'inherit'}}>
                      <span style={{width:20,height:20,borderRadius:5,background:'#0d948818',color:'#0d9488',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                      <span style={{fontSize:12,fontWeight:500,color:'var(--tx)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}} title={name}>{name}</span>
                      {v.count&&<span style={{fontSize:11,color:'#0d9488',fontWeight:600,flexShrink:0}}>{v.count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top papers */}
          <div className="panel-card">
            <h3 style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              📄 {selVenue ? `Papers in "${selVenue}"` : `All Analyzed Papers (${displayed.length})`}
              {scimagoOnly&&<span style={{fontSize:11,background:'#dcfce7',color:'#15803d',padding:'2px 8px',borderRadius:20,fontWeight:600}}>SCImago only</span>}
              {!selVenue && <span style={{fontSize:12,color:'var(--tx3)',fontWeight:400}}>— sorted by relevance by default</span>}
              {selVenue && (
                <button onClick={()=>setSelVenue(null)}
                  style={{fontSize:11,fontWeight:600,color:'#0d9488',background:'#0d948818',border:'1px solid #0d948840',borderRadius:20,padding:'2px 10px',cursor:'pointer'}}>
                  ✕ Clear venue filter
                </button>
              )}
              <div style={{flex:1}}/>
              <SortSelect value={sortBy} onChange={setSortBy}/>
            </h3>
            {displayed.length===0&&(
              <div className="empty">{selVenue ? `No papers found for "${selVenue}" under the current filters.` : 'No officially ranked papers found. Disable SCImago filter to see all papers.'}</div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {sortPapers(displayed, sortBy).map((p,i)=>(
                <div key={i} style={{display:'flex',gap:12,padding:'12px 14px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--bd)',transition:'border-color .13s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='#0d9488'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--bd)'}>
                  <div style={{width:28,height:28,borderRadius:8,background:'#0d948818',border:'1.5px solid #0d948840',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,color:'#0d9488',flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <a href={`https://www.google.com/search?q=${encodeURIComponent((p.title||'')+' research paper')}`}
                      target="_blank" rel="noreferrer"
                      style={{fontSize:13.5,fontWeight:600,color:'var(--tx)',textDecoration:'none',display:'block',marginBottom:5,lineHeight:1.4}}
                      onMouseEnter={e=>e.target.style.color='#0d9488'}
                      onMouseLeave={e=>e.target.style.color='var(--tx)'}>
                      {p.title}
                    </a>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:5}}>
                      <QBadge quartile={p.quartile} approxQuartile={p.approx_quartile} isApprox={p.is_approx}/>
                      {p.year&&<span style={{fontSize:11,color:'var(--tx3)'}}>{p.year}</span>}
                      {p.venue&&<span style={{fontSize:11,color:'var(--tx3)',fontStyle:'italic'}}>{p.venue}</span>}
                      <span style={{fontSize:11,fontWeight:600,background:'#0d948818',color:'#0d9488',padding:'1px 7px',borderRadius:20}}>
                        {(p.similarity*100).toFixed(1)}% relevant
                      </span>
                      {p.is_approx&&<span className="tag tag-approx">≈ estimated</span>}
                    </div>
                    {p.abstract&&(
                      <p style={{fontSize:12,color:'var(--tx2)',lineHeight:1.6,margin:0}}>
                        {p.abstract.slice(0,220)}{p.abstract.length>220?'…':''}
                      </p>
                    )}
                  </div>
                  <a href={`https://www.google.com/search?q=${encodeURIComponent((p.title||'')+' research paper')}`}
                    target="_blank" rel="noreferrer" style={{color:'var(--acc)',opacity:.6,alignSelf:'flex-start',marginTop:2,flexShrink:0}}>
                    <ExternalLink size={14}/>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
