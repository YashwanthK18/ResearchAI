import { useState } from 'react';
import { GitBranch, Loader2, ChevronRight } from 'lucide-react';
import { fetchEvolution } from '../lib/api';
import CenteredSearch from './CenteredSearch';
import ScimagoToggle from './ScimagoToggle';

const EXAMPLES = ['object detection','natural language processing','reinforcement learning','computer vision'];

export default function EvolutionPanel({ sharedQuery }) {
  const [query,       setQuery]       = useState(sharedQuery||'');
  const [data,        setData]        = useState(null);
  const [load,        setLoad]        = useState(false);
  const [err,         setErr]         = useState(null);
  const [sel,         setSel]         = useState(null);
  const [scimagoOnly, setScimagoOnly] = useState(false);

  async function run(e) {
    e?.preventDefault(); if (!query.trim()) return;
    setLoad(true); setErr(null); setData(null); setSel(null);
    try { setData(await fetchEvolution(query, 800, scimagoOnly)); }
    catch(e) { setErr(e.message||'Error'); }
    finally { setLoad(false); }
  }

  async function handleToggle(val) {
    setScimagoOnly(val);
    if (data) {
      setLoad(true); setErr(null); setSel(null);
      try { setData(await fetchEvolution(query, 800, val)); }
      catch(e) { setErr(e.message); }
      finally { setLoad(false); }
    }
  }

  const buckets = data?.buckets||[];
  const maxCount = Math.max(...buckets.map(b=>b.paper_count),1);
  const selected = sel!==null ? buckets[sel] : null;

  if (!data && !load && !err) {
    return (
      <CenteredSearch
        icon="🔬" title="Research Evolution"
        subtitle="Track how a research topic evolved year by year across 800 papers — discover how methods, terminology, and focus areas shifted over time"
        placeholder='"object detection" or "transformer models"'
        examples={EXAMPLES} value={query} onChange={setQuery}
        onSubmit={run} loading={load} buttonLabel="Analyze Evolution" accentColor="#9333ea"
        filter={<ScimagoToggle value={scimagoOnly} onChange={handleToggle}/>}
      />
    );
  }

  return (
    <div style={{maxWidth:1100}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div className="ph" style={{marginBottom:0}}>
          <h2>Research Evolution</h2>
          <p>How "{query}" evolved — click any year to explore</p>
        </div>
        <ScimagoToggle value={scimagoOnly} onChange={handleToggle}/>
      </div>

      <form onSubmit={run} style={{display:'flex',gap:8,marginBottom:20}}>
        <div className="sbar" style={{flex:1}}>
          <GitBranch size={15} className="sbar-ico"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search a topic..."/>
        </div>
        <button className="btn btn-acc" style={{background:'#9333ea'}} disabled={load}>
          {load?<Loader2 size={14} className="spin"/>:'Analyze'}
        </button>
      </form>

      {err  && <p className="err">{err}</p>}
      {load && <div className="loading"><Loader2 size={18} className="spin"/>Analyzing 800 papers on "{query}"…</div>}
      {data && !load && buckets.length===0 && <div className="empty">No papers found. Try a broader topic.</div>}

      {data && !load && buckets.length>0 && (
        <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:20,alignItems:'start'}}>
          {/* Timeline */}
          <div style={{background:'var(--surf)',border:'1px solid var(--bd)',borderRadius:'var(--r)',overflow:'hidden',position:'sticky',top:70}}>
            <div style={{padding:'12px 14px',borderBottom:'1px solid var(--bd)',fontSize:11.5,fontWeight:700,color:'var(--tx2)',textTransform:'uppercase',letterSpacing:'.06em',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>{buckets.length} years · {buckets.reduce((s,b)=>s+b.paper_count,0).toLocaleString()} papers</span>
              {scimagoOnly&&<span style={{background:'#dcfce7',color:'#15803d',padding:'2px 7px',borderRadius:20,fontSize:10,fontWeight:700}}>SCImago</span>}
            </div>
            <div style={{maxHeight:520,overflowY:'auto'}}>
              {buckets.map((b,i)=>{
                const pct=Math.max(8,(b.paper_count/maxCount)*100);
                const isSel=sel===i;
                return (
                  <button key={b.year} onClick={()=>setSel(isSel?null:i)}
                    style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 12px',border:'none',borderBottom:'1px solid var(--bd)',background:isSel?'#f5f3ff':'transparent',cursor:'pointer',textAlign:'left',borderLeft:isSel?'3px solid #9333ea':'3px solid transparent',transition:'all .13s'}}>
                    <span style={{fontSize:13,fontWeight:700,color:isSel?'#9333ea':'var(--tx)',width:36,flexShrink:0}}>{b.year}</span>
                    <div style={{flex:1,height:16,background:'var(--bg)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,background:isSel?'#9333ea':'#9333ea44',borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:11,color:'var(--tx3)',width:26,textAlign:'right',flexShrink:0}}>{b.paper_count}</span>
                    <ChevronRight size={12} color={isSel?'#9333ea':'var(--tx3)'} style={{flexShrink:0,transform:isSel?'rotate(90deg)':'none',transition:'transform .13s'}}/>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail */}
          <div>
            {!selected ? (
              <div style={{background:'var(--surf)',border:'2px dashed var(--bd)',borderRadius:'var(--r)',padding:'60px 30px',textAlign:'center',color:'var(--tx3)'}}>
                <div style={{fontSize:40,marginBottom:12}}>👈</div>
                <div style={{fontSize:15,fontWeight:600,color:'var(--tx2)',marginBottom:6}}>Select a year to explore</div>
                <div style={{fontSize:13}}>Click any year on the timeline to see dominant terms and sample papers</div>
              </div>
            ) : (
              <div style={{background:'var(--surf)',border:'1px solid var(--bd)',borderRadius:'var(--r)',overflow:'hidden'}}>
                <div style={{padding:'18px 20px',background:'linear-gradient(135deg,#9333ea12,#9333ea04)',borderBottom:'1px solid var(--bd)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                    <span style={{fontSize:30,fontWeight:800,color:'#9333ea'}}>{selected.year}</span>
                    <span style={{padding:'3px 10px',background:'#9333ea18',color:'#9333ea',borderRadius:20,fontSize:12,fontWeight:600}}>{selected.paper_count} papers</span>
                    {sel>0&&(
                      <span style={{fontSize:12,color:selected.paper_count>buckets[sel-1].paper_count?'#16a34a':'#dc2626'}}>
                        {selected.paper_count>buckets[sel-1].paper_count?'📈':'📉'}
                        {' '}{Math.abs(selected.paper_count-buckets[sel-1].paper_count)} vs {buckets[sel-1].year}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{padding:'18px 20px'}}>
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--tx2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>Dominant Terms in {selected.year}</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                      {selected.top_terms.map((t,i)=>(
                        <span key={t} style={{padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:600,background:i<3?'#9333ea':i<6?'#9333ea18':'var(--bg)',color:i<3?'#fff':'#9333ea',border:i<3?'none':'1px solid #9333ea44'}}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--tx2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>Sample Papers from {selected.year}</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {selected.sample_titles.map((t,i)=>(
                        <a key={i} href={`https://www.google.com/search?q=${encodeURIComponent(t+' research paper')}`}
                          target="_blank" rel="noreferrer"
                          style={{display:'block',padding:'10px 12px',background:'var(--bg)',borderRadius:'var(--rs)',border:'1px solid var(--bd)',fontSize:13,fontWeight:500,color:'var(--tx)',textDecoration:'none',lineHeight:1.5,transition:'all .13s'}}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor='#9333ea';e.currentTarget.style.color='#9333ea';}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--bd)';e.currentTarget.style.color='var(--tx)';}}>
                          {t}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
