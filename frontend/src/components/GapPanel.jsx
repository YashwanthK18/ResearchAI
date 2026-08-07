import { useState } from 'react';
import { AlertCircle, Loader2, TrendingDown, Lightbulb, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchGap } from '../lib/api';
import CenteredSearch from './CenteredSearch';
import ScimagoToggle from './ScimagoToggle';

const EXAMPLES = ['federated learning','explainable AI','quantum computing','edge computing'];

export default function GapPanel({ sharedQuery }) {
  const [query,       setQuery]       = useState(sharedQuery||'');
  const [data,        setData]        = useState(null);
  const [load,        setLoad]        = useState(false);
  const [err,         setErr]         = useState(null);
  const [scimagoOnly, setScimagoOnly] = useState(false);

  async function run(e) {
    e?.preventDefault(); if (!query.trim()) return;
    setLoad(true); setErr(null); setData(null);
    try { setData(await fetchGap(query, 1500, scimagoOnly)); }
    catch(e) { setErr(e.message||'Error'); }
    finally { setLoad(false); }
  }

  async function handleToggle(val) {
    setScimagoOnly(val);
    if (data) {
      setLoad(true); setErr(null);
      try { setData(await fetchGap(query, 1500, val)); }
      catch(e) { setErr(e.message); }
      finally { setLoad(false); }
    }
  }

  const gapYears      = new Set((data?.gaps||[]).filter(g=>g.year).map(g=>g.year));
  const temporalGaps  = (data?.gaps||[]).filter(g=>g.type==='temporal_gap');
  const subtopicGaps  = (data?.gaps||[]).filter(g=>g.type==='subtopic_gap');

  if (!data && !load && !err) {
    return (
      <div>
        <CenteredSearch
          icon="🔍" title="Research Gap Finder"
          subtitle="Find WHERE research is missing — years with unusually few papers and subtopics that haven't been explored. Analyzed across 1,500 papers for statistical reliability."
          placeholder='"federated learning" or "edge computing security"'
          examples={EXAMPLES} value={query} onChange={setQuery}
          onSubmit={run} loading={load} buttonLabel="Find Gaps" accentColor="#dc2626"
          filter={<ScimagoToggle value={scimagoOnly} onChange={handleToggle}/>}
        />
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,maxWidth:640,margin:'0 auto',padding:'0 20px 40px'}}>
          <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'var(--r)',padding:'14px 16px'}}>
            <div style={{fontWeight:700,color:'#dc2626',marginBottom:6,fontSize:13}}>🔍 Research Gap (this page)</div>
            <div style={{fontSize:12,color:'#7f1d1d',lineHeight:1.6}}>Shows WHERE research is <strong>missing</strong>. Use this to justify your project's contribution area.</div>
          </div>
          <div style={{background:'#f5f3ff',border:'1px solid #e9d5ff',borderRadius:'var(--r)',padding:'14px 16px'}}>
            <div style={{fontWeight:700,color:'#9333ea',marginBottom:6,fontSize:13}}>🔬 Research Evolution</div>
            <div style={{fontSize:12,color:'#4c1d95',lineHeight:1.6}}>Shows HOW research <strong>changed</strong> over time. Use this to understand a topic's history.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{maxWidth:960}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div className="ph" style={{marginBottom:0}}>
          <h2>Research Gap Finder</h2>
          <p>Identifying gaps across 1,500 papers — use these to justify your project's novelty</p>
        </div>
        <ScimagoToggle value={scimagoOnly} onChange={handleToggle}/>
      </div>

      <form onSubmit={run} style={{display:'flex',gap:8,marginBottom:20}}>
        <div className="sbar" style={{flex:1}}>
          <Search size={15} className="sbar-ico"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search a topic..."/>
        </div>
        <button className="btn btn-acc" style={{background:'#dc2626'}} disabled={load}>
          {load?<Loader2 size={14} className="spin"/>:'Find Gaps'}
        </button>
      </form>

      {err  && <p className="err">{err}</p>}
      {load && <div className="loading"><Loader2 size={18} className="spin"/>Analyzing 1,500 papers on "{query}"…</div>}

      {data && !load && (
        <>
          <div style={{background:'linear-gradient(135deg,#4f6ef710,#9333ea08)',border:'1px solid #4f6ef730',borderRadius:'var(--r)',padding:'12px 16px',marginBottom:20,display:'flex',gap:10,alignItems:'flex-start'}}>
            <Lightbulb size={16} color="#4f6ef7" style={{flexShrink:0,marginTop:1}}/>
            <span style={{fontSize:12,color:'var(--tx2)'}}>
              <strong style={{color:'var(--tx)'}}>For your project paper:</strong> Red bars = years with fewer papers than expected. Purple cards = angles rarely explored. Both are evidence of a research gap you can justify contributing to.
              {scimagoOnly&&<span style={{marginLeft:6,color:'#16a34a',fontWeight:600}}> Showing SCImago-matched papers only.</span>}
            </span>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
            <div className="stat-card"><div className="stat-num">{data.total_papers_analyzed.toLocaleString()}</div><div className="stat-lbl">Papers Analyzed</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:'#dc2626'}}>{temporalGaps.length}</div><div className="stat-lbl">Temporal Gaps</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:'#9333ea'}}>{subtopicGaps.length}</div><div className="stat-lbl">Subtopic Gaps</div></div>
          </div>

          <div className="panel-card">
            <h3 style={{marginBottom:4}}>Publication Density Over Time</h3>
            <p style={{fontSize:12,color:'var(--tx2)',marginBottom:16,display:'flex',alignItems:'center',gap:14}}>
              <span><span style={{display:'inline-block',width:10,height:10,background:'#dc2626',borderRadius:2,marginRight:5}}/>Gap years (below expected)</span>
              <span><span style={{display:'inline-block',width:10,height:10,background:'#4f6ef7',borderRadius:2,marginRight:5}}/>Normal activity</span>
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.year_distribution} margin={{top:5,right:10,left:0,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f4"/>
                <XAxis dataKey="year" tick={{fontSize:11}} stroke="#94a3b8" tickFormatter={y=>y%2===0?y:''}/>
                <YAxis tick={{fontSize:11}} stroke="#94a3b8"/>
                <Tooltip contentStyle={{background:'#fff',border:'1px solid #e2e8f4',borderRadius:8,fontSize:12}}
                  formatter={(v,n,p)=>[v+' papers',gapYears.has(p.payload.year)?'⚠ GAP YEAR':'Publications']}/>
                <Bar dataKey="count" radius={[3,3,0,0]}>
                  {data.year_distribution.map((entry,i)=>(
                    <Cell key={i} fill={gapYears.has(entry.year)?'#dc2626':'#4f6ef7'} opacity={gapYears.has(entry.year)?1:0.65}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {temporalGaps.length>0&&(
            <div className="panel-card">
              <h3><TrendingDown size={16} color="#dc2626"/> Temporal Gaps — Under-researched Years</h3>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {temporalGaps.map((g,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 14px',background:'#fef2f2',border:'1px solid #fecaca',borderLeft:'4px solid #dc2626',borderRadius:'var(--rs)'}}>
                    <div style={{textAlign:'center',minWidth:52}}>
                      <div style={{fontSize:20,fontWeight:800,color:'#dc2626'}}>{g.year}</div>
                      <div style={{fontSize:10,color:'#b91c1c',fontWeight:700}}>GAP</div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:'var(--tx)',marginBottom:3}}>{g.insight}</div>
                      <div style={{fontSize:11,color:'#b91c1c'}}>{(g.gap_severity*100).toFixed(0)}% below expected · {g.papers_found} found vs ~{g.expected} expected</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subtopicGaps.length>0&&(
            <div className="panel-card">
              <h3><AlertCircle size={16} color="#9333ea"/> Subtopic Gaps — Under-explored Angles</h3>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {subtopicGaps.map((g,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 14px',background:'#faf5ff',border:'1px solid #e9d5ff',borderLeft:'4px solid #9333ea',borderRadius:'var(--rs)'}}>
                    <span style={{fontSize:11,fontWeight:700,color:'#7e22ce',background:'#ede9fe',padding:'3px 8px',borderRadius:20,whiteSpace:'nowrap',flexShrink:0}}>"{g.term}"</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:'var(--tx)',marginBottom:4}}>{g.insight}</div>
                      <div style={{fontSize:11,color:'#7e22ce',fontWeight:500}}>💡 Could you apply "{g.term}" techniques to {query}?</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.gaps.length===0&&(
            <div style={{textAlign:'center',padding:'40px 20px',background:'var(--surf)',border:'1px solid var(--bd)',borderRadius:'var(--r)'}}>
              <TrendingDown size={36} color="var(--tx3)" style={{marginBottom:12}}/>
              <div style={{fontSize:15,fontWeight:600,color:'var(--tx2)',marginBottom:6}}>No significant gaps found</div>
              <div style={{fontSize:13,color:'var(--tx3)'}}>This topic has consistent coverage. Try a more specific subtopic.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
