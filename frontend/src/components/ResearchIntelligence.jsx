import { useState, useCallback } from 'react';
import { TrendingUp, GitBranch, Search, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts';
import { fetchTrend, fetchEvolution, fetchGap } from '../lib/api';
import ScimagoToggle from './ScimagoToggle';
import CenteredSearch from './CenteredSearch';

const TABS = [
  { id:'trend',     label:'Trend',     icon:'📈', desc:'Publication count per year' },
  { id:'evolution', label:'Evolution', icon:'🔬', desc:'How the topic changed over time' },
  { id:'gap',       label:'Gaps',      icon:'🔍', desc:'Under-researched years & angles' },
];

const EXAMPLES = ['deep learning','federated learning','object detection','natural language processing','graph neural networks'];

export default function ResearchIntelligence({ sharedQuery }) {
  const [query,       setQuery]       = useState(sharedQuery || '');
  const [activeTab,   setActiveTab]   = useState('trend');
  const [scimagoOnly, setScimagoOnly] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

  // Data for all three tabs
  const [trendData, setTrendData]     = useState(null);
  const [evoData,   setEvoData]       = useState(null);
  const [gapData,   setGapData]       = useState(null);
  const [lastQuery, setLastQuery]     = useState('');
  const [selYear,   setSelYear]       = useState(null);

  async function runAll(q, scimago) {
    if (!q.trim()) return;
    setLoading(true); setError(null); setSelYear(null);
    try {
      const [t, e, g] = await Promise.all([
        fetchTrend(q, 1200, scimago),
        fetchEvolution(q, 800, scimago),
        fetchGap(q, 1500, scimago),
      ]);
      setTrendData(t); setEvoData(e); setGapData(g);
      setLastQuery(q);
    } catch(err) { setError(err.message || 'Error'); }
    finally { setLoading(false); }
  }

  function handleSubmit(e) {
    e?.preventDefault();
    runAll(query, scimagoOnly);
  }

  async function handleScimagoToggle(val) {
    setScimagoOnly(val);
    if (lastQuery) runAll(lastQuery, val);
  }

  const hasData = trendData || evoData || gapData;

  if (!hasData && !loading && !error) {
    return (
      <CenteredSearch
        icon="🧠" title="Research Intelligence"
        subtitle="Analyze any research topic across three dimensions: publication trends over time, how the field evolved, and where the research gaps are — all in one place."
        placeholder='"federated learning" or "object detection"'
        examples={EXAMPLES} value={query} onChange={setQuery}
        onSubmit={handleSubmit} loading={loading} buttonLabel="Analyze Topic" accentColor="#4f6ef7"
        filter={<ScimagoToggle value={scimagoOnly} onChange={setScimagoOnly}/>}
      />
    );
  }

  return (
    <div style={{maxWidth:1100}}>
      {/* Header + controls */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div className="ph" style={{marginBottom:0}}>
          <h2>Research Intelligence</h2>
          <p>Trend · Evolution · Gaps — all for one topic, in one place</p>
        </div>
        <ScimagoToggle value={scimagoOnly} onChange={handleScimagoToggle}/>
      </div>

      {/* Search bar — query carries across all tabs */}
      <form onSubmit={handleSubmit} style={{display:'flex',gap:8,marginBottom:20}}>
        <div className="sbar" style={{flex:1}}>
          <Search size={15} className="sbar-ico"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder='e.g. "transformer models" or "federated learning"'/>
        </div>
        <button className="btn btn-acc" disabled={loading}>
          {loading ? <Loader2 size={14} className="spin"/> : 'Analyze'}
        </button>
      </form>

      {error  && <p className="err">{error}</p>}
      {loading && (
        <div className="loading">
          <Loader2 size={18} className="spin"/>
          Analyzing 1,200 + 800 + 1,500 papers across trend, evolution and gap…
        </div>
      )}

      {hasData && !loading && (
        <>
          {/* Stats row */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
            <div className="stat-card">
              <div className="stat-num">{trendData?.total_matched?.toLocaleString()||'—'}</div>
              <div className="stat-lbl">Papers (Trend)</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{evoData?.buckets?.length||'—'}</div>
              <div className="stat-lbl">Years in Dataset</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{color:'#dc2626'}}>
                {gapData?.gaps?.filter(g=>g.type==='temporal_gap').length||0}
              </div>
              <div className="stat-lbl">Temporal Gaps</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{color:'#9333ea'}}>
                {gapData?.gaps?.filter(g=>g.type==='subtopic_gap').length||0}
              </div>
              <div className="stat-lbl">Subtopic Gaps</div>
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{display:'flex',gap:6,marginBottom:16,background:'var(--surf)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:5}}>
            {TABS.map(tab=>(
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                style={{
                  flex:1,padding:'10px 14px',border:'none',borderRadius:8,cursor:'pointer',
                  background:activeTab===tab.id?'var(--acc)':'transparent',
                  color:activeTab===tab.id?'#fff':'var(--tx2)',
                  fontWeight:600,fontSize:13,transition:'all .13s',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                }}>
                <span style={{fontSize:18}}>{tab.icon}</span>
                <span>{tab.label}</span>
                <span style={{fontSize:10,opacity:.8,fontWeight:400}}>{tab.desc}</span>
              </button>
            ))}
          </div>

          {/* TAB: TREND */}
          {activeTab==='trend' && trendData && <TrendView data={trendData} scimagoOnly={scimagoOnly}/>}

          {/* TAB: EVOLUTION */}
          {activeTab==='evolution' && evoData && (
            <EvolutionView data={evoData} selYear={selYear} setSelYear={setSelYear} scimagoOnly={scimagoOnly}/>
          )}

          {/* TAB: GAP */}
          {activeTab==='gap' && gapData && <GapView data={gapData} scimagoOnly={scimagoOnly}/>}
        </>
      )}
    </div>
  );
}

/* ── TREND VIEW ─────────────────────────────────────────────────────────────── */
function TrendView({ data, scimagoOnly }) {
  const points   = data.points || [];
  const maxCount = Math.max(...points.map(p=>p.count), 1);
  const peakYear = points.find(p=>p.count===maxCount);
  return (
    <div>
      <div className="panel-card">
        <h3 style={{display:'flex',alignItems:'center',gap:8}}>
          <TrendingUp size={16}/> "{data.query}" — Publication Trend
          {scimagoOnly&&<span style={{fontSize:11,background:'#dcfce7',color:'#15803d',padding:'2px 8px',borderRadius:20,fontWeight:600}}>SCImago only</span>}
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={points} margin={{top:5,right:20,left:0,bottom:5}}>
            <defs>
              <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4f6ef7" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f4"/>
            <XAxis dataKey="year" tick={{fontSize:11}} stroke="#94a3b8"/>
            <YAxis tick={{fontSize:11}} stroke="#94a3b8"/>
            <Tooltip contentStyle={{background:'#fff',border:'1px solid #e2e8f4',borderRadius:8,fontSize:12}}
              formatter={v=>[v+' papers','Publications']}/>
            {peakYear&&<ReferenceLine x={peakYear.year} stroke="#4f6ef7" strokeDasharray="4 2"
              label={{value:'Peak',fill:'#4f6ef7',fontSize:11}}/>}
            <Area type="monotone" dataKey="count" stroke="#4f6ef7" strokeWidth={2.5}
              fill="url(#tg)" dot={{r:3,fill:'#4f6ef7'}} activeDot={{r:6}}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="panel-card">
        <h3>Year-by-Year Breakdown</h3>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          {[...points].reverse().map(p=>{
            const pct=Math.max(6,(p.count/maxCount)*100);
            const isPeak=p.year===peakYear?.year;
            return (
              <div key={p.year} style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{width:38,fontSize:12,fontWeight:isPeak?800:600,color:isPeak?'var(--acc)':'var(--tx2)',textAlign:'right',flexShrink:0}}>{p.year}</span>
                <div style={{flex:1,height:22,background:'var(--bg)',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:'var(--acc)',opacity:isPeak?1:0.45,borderRadius:4,display:'flex',alignItems:'center',paddingLeft:6}}>
                    {pct>15&&<span style={{fontSize:10,fontWeight:700,color:'#fff'}}>{p.count}</span>}
                  </div>
                </div>
                <span style={{width:40,fontSize:11,color:'var(--tx3)',textAlign:'right',fontWeight:isPeak?700:400}}>{p.count}</span>
                {isPeak&&<span style={{fontSize:10,color:'var(--acc)',fontWeight:700,flexShrink:0}}>PEAK</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── EVOLUTION VIEW ─────────────────────────────────────────────────────────── */
function EvolutionView({ data, selYear, setSelYear, scimagoOnly }) {
  const buckets  = data.buckets || [];
  const maxCount = Math.max(...buckets.map(b=>b.paper_count), 1);
  const selected = selYear !== null ? buckets[selYear] : null;
  return (
    <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:20}}>
      <div style={{background:'var(--surf)',border:'1px solid var(--bd)',borderRadius:'var(--r)',overflow:'hidden',position:'sticky',top:70}}>
        <div style={{padding:'12px 14px',borderBottom:'1px solid var(--bd)',fontSize:11.5,fontWeight:700,color:'var(--tx2)',textTransform:'uppercase',letterSpacing:'.06em',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>{buckets.length} years</span>
          {scimagoOnly&&<span style={{background:'#dcfce7',color:'#15803d',padding:'2px 7px',borderRadius:20,fontSize:10}}>SCImago</span>}
        </div>
        <div style={{maxHeight:480,overflowY:'auto'}}>
          {buckets.map((b,i)=>{
            const pct=Math.max(8,(b.paper_count/maxCount)*100);
            const isSel=selYear===i;
            return (
              <button key={b.year} onClick={()=>setSelYear(isSel?null:i)}
                style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 12px',border:'none',borderBottom:'1px solid var(--bd)',background:isSel?'#f5f3ff':'transparent',cursor:'pointer',textAlign:'left',borderLeft:isSel?'3px solid #9333ea':'3px solid transparent',transition:'all .13s'}}>
                <span style={{fontSize:13,fontWeight:700,color:isSel?'#9333ea':'var(--tx)',width:36,flexShrink:0}}>{b.year}</span>
                <div style={{flex:1,height:16,background:'var(--bg)',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:isSel?'#9333ea':'#9333ea44',borderRadius:3}}/>
                </div>
                <span style={{fontSize:11,color:'var(--tx3)',width:24,textAlign:'right',flexShrink:0}}>{b.paper_count}</span>
                <ChevronRight size={12} color={isSel?'#9333ea':'var(--tx3)'} style={{flexShrink:0,transform:isSel?'rotate(90deg)':'none',transition:'transform .13s'}}/>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        {!selected ? (
          <div style={{background:'var(--surf)',border:'2px dashed var(--bd)',borderRadius:'var(--r)',padding:'60px 30px',textAlign:'center',color:'var(--tx3)'}}>
            <div style={{fontSize:40,marginBottom:12}}>👈</div>
            <div style={{fontSize:15,fontWeight:600,color:'var(--tx2)',marginBottom:6}}>Select a year</div>
            <div style={{fontSize:13}}>Click any year on the timeline to see dominant terms and sample papers</div>
          </div>
        ) : (
          <div style={{background:'var(--surf)',border:'1px solid var(--bd)',borderRadius:'var(--r)',overflow:'hidden'}}>
            <div style={{padding:'18px 20px',background:'linear-gradient(135deg,#9333ea12,#9333ea04)',borderBottom:'1px solid var(--bd)'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                <span style={{fontSize:30,fontWeight:800,color:'#9333ea'}}>{selected.year}</span>
                <span style={{padding:'3px 10px',background:'#9333ea18',color:'#9333ea',borderRadius:20,fontSize:12,fontWeight:600}}>{selected.paper_count} papers</span>
                {selYear>0&&(
                  <span style={{fontSize:12,color:selected.paper_count>buckets[selYear-1].paper_count?'#16a34a':'#dc2626'}}>
                    {selected.paper_count>buckets[selYear-1].paper_count?'📈':'📉'} {Math.abs(selected.paper_count-buckets[selYear-1].paper_count)} vs {buckets[selYear-1].year}
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
                <div style={{fontSize:11,fontWeight:700,color:'var(--tx2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>Sample Papers</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {selected.sample_titles.map((t,i)=>(
                    <a key={i} href={`https://www.google.com/search?q=${encodeURIComponent(t+' research paper')}`} target="_blank" rel="noreferrer"
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
  );
}

/* ── GAP VIEW ────────────────────────────────────────────────────────────────── */
function GapView({ data, scimagoOnly }) {
  const gapYears     = new Set((data.gaps||[]).filter(g=>g.year).map(g=>g.year));
  const temporalGaps = (data.gaps||[]).filter(g=>g.type==='temporal_gap');
  const subtopicGaps = (data.gaps||[]).filter(g=>g.type==='subtopic_gap');
  return (
    <div>
      <div className="panel-card">
        <h3 style={{marginBottom:4}}>Publication Density Over Time</h3>
        <p style={{fontSize:12,color:'var(--tx2)',marginBottom:14,display:'flex',alignItems:'center',gap:14}}>
          <span><span style={{display:'inline-block',width:10,height:10,background:'#dc2626',borderRadius:2,marginRight:5}}/>Gap years</span>
          <span><span style={{display:'inline-block',width:10,height:10,background:'#4f6ef7',borderRadius:2,marginRight:5}}/>Normal</span>
          {scimagoOnly&&<span style={{background:'#dcfce7',color:'#15803d',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>SCImago only</span>}
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.year_distribution} margin={{top:5,right:10,left:0,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f4"/>
            <XAxis dataKey="year" tick={{fontSize:11}} stroke="#94a3b8" tickFormatter={y=>y%2===0?y:''}/>
            <YAxis tick={{fontSize:11}} stroke="#94a3b8"/>
            <Tooltip contentStyle={{background:'#fff',border:'1px solid #e2e8f4',borderRadius:8,fontSize:12}}
              formatter={(v,n,p)=>[v+' papers',gapYears.has(p.payload.year)?'⚠ GAP YEAR':'Publications']}/>
            <Bar dataKey="count" radius={[3,3,0,0]}>
              {(data.year_distribution||[]).map((e,i)=>(
                <Cell key={i} fill={gapYears.has(e.year)?'#dc2626':'#4f6ef7'} opacity={gapYears.has(e.year)?1:0.6}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <div className="panel-card" style={{marginBottom:0}}>
          <h3 style={{color:'#dc2626',marginBottom:12}}>⏱ Temporal Gaps ({temporalGaps.length})</h3>
          {temporalGaps.length===0&&<p style={{fontSize:13,color:'var(--tx3)'}}>No significant temporal gaps found.</p>}
          {temporalGaps.map((g,i)=>(
            <div key={i} style={{padding:'10px 12px',background:'#fef2f2',border:'1px solid #fecaca',borderLeft:'3px solid #dc2626',borderRadius:'var(--rs)',marginBottom:8}}>
              <div style={{fontSize:18,fontWeight:800,color:'#dc2626'}}>{g.year} <span style={{fontSize:11,fontWeight:600}}>({(g.gap_severity*100).toFixed(0)}% below avg)</span></div>
              <div style={{fontSize:12,color:'#7f1d1d',marginTop:3}}>{g.insight}</div>
            </div>
          ))}
        </div>
        <div className="panel-card" style={{marginBottom:0}}>
          <h3 style={{color:'#9333ea',marginBottom:12}}>💡 Subtopic Gaps ({subtopicGaps.length})</h3>
          {subtopicGaps.length===0&&<p style={{fontSize:13,color:'var(--tx3)'}}>No subtopic gaps found.</p>}
          {subtopicGaps.map((g,i)=>(
            <div key={i} style={{padding:'10px 12px',background:'#faf5ff',border:'1px solid #e9d5ff',borderLeft:'3px solid #9333ea',borderRadius:'var(--rs)',marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:700,color:'#7e22ce'}}>"{g.term}"</div>
              <div style={{fontSize:12,color:'#4c1d95',marginTop:3}}>{g.insight}</div>
              <div style={{fontSize:11,color:'#9333ea',marginTop:4,fontWeight:500}}>💡 Could you apply "{g.term}" to {data.query}?</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
