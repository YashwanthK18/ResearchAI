import { useState } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fetchTrend } from '../lib/api';
import CenteredSearch from './CenteredSearch';
import ScimagoToggle from './ScimagoToggle';

const EXAMPLES = ['deep learning','federated learning','large language models','graph neural networks'];

export default function TrendPanel({ sharedQuery }) {
  const [query,       setQuery]       = useState(sharedQuery||'');
  const [data,        setData]        = useState(null);
  const [load,        setLoad]        = useState(false);
  const [err,         setErr]         = useState(null);
  const [scimagoOnly, setScimagoOnly] = useState(false);

  async function run(e, overrideQuery) {
    e?.preventDefault();
    const q = overrideQuery || query;
    if (!q.trim()) return;
    setLoad(true); setErr(null);
    try { setData(await fetchTrend(q, 1200, scimagoOnly)); }
    catch(e) { setErr(e.message||'Error'); }
    finally { setLoad(false); }
  }

  async function handleToggle(val) {
    setScimagoOnly(val);
    if (data) {
      setLoad(true); setErr(null);
      try { setData(await fetchTrend(query, 1200, val)); }
      catch(e) { setErr(e.message); }
      finally { setLoad(false); }
    }
  }

  const points    = data?.points || [];
  const maxCount  = Math.max(...points.map(p=>p.count), 1);
  const peakYear  = points.find(p=>p.count===maxCount);
  const totalPapers = data?.total_matched || 0;

  if (!data && !load && !err) {
    return (
      <CenteredSearch
        icon="📈" title="Publication Trends"
        subtitle="See how research activity changed year by year — analyzed across 1,200 papers for statistical reliability. Identify growing fields and spot when a topic took off."
        placeholder="e.g. deep learning, blockchain, federated learning"
        examples={EXAMPLES} value={query} onChange={setQuery}
        onSubmit={run} loading={load} buttonLabel="Analyze Trend" accentColor="#4f6ef7"
        filter={<ScimagoToggle value={scimagoOnly} onChange={setScimagoOnly}/>}
      />
    );
  }

  return (
    <div style={{maxWidth:960}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div className="ph" style={{marginBottom:0}}>
          <h2>Publication Trends</h2>
          <p>Analyzing top 1,200 most relevant papers for year-by-year distribution</p>
        </div>
        <ScimagoToggle value={scimagoOnly} onChange={handleToggle}/>
      </div>

      <form onSubmit={run} style={{display:'flex',gap:8,marginBottom:20}}>
        <div className="sbar" style={{flex:1}}>
          <TrendingUp size={15} className="sbar-ico"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search a topic..."/>
        </div>
        <button className="btn btn-acc" disabled={load}>
          {load ? <Loader2 size={14} className="spin"/> : 'Analyze'}
        </button>
      </form>

      {err  && <p className="err">{err}</p>}
      {load && <div className="loading"><Loader2 size={18} className="spin"/>Analyzing 1,200 papers on "{query}"…</div>}

      {data && !load && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
            <div className="stat-card">
              <div className="stat-num">{totalPapers.toLocaleString()}</div>
              <div className="stat-lbl">Papers Found</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{points.length}</div>
              <div className="stat-lbl">Years Covered</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{fontSize:20}}>{peakYear?.year||'—'}</div>
              <div className="stat-lbl">Peak Year ({peakYear?.count||0} papers)</div>
            </div>
          </div>

          <div className="panel-card">
            <h3 style={{display:'flex',alignItems:'center',gap:8}}>
              <TrendingUp size={16}/> "{data.query}"
              {scimagoOnly&&<span style={{fontSize:11,background:'#dcfce7',color:'#15803d',padding:'2px 8px',borderRadius:20,fontWeight:600}}>SCImago only</span>}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={points} margin={{top:5,right:20,left:0,bottom:5}}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#trendGrad)" dot={{r:3,fill:'#4f6ef7'}} activeDot={{r:6}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-card">
            <h3>Year-by-Year Breakdown</h3>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {[...points].reverse().map(p=>{
                const pct = Math.max(6,(p.count/maxCount)*100);
                const isPeak = p.year===peakYear?.year;
                return (
                  <div key={p.year} style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{width:38,fontSize:12,fontWeight:isPeak?800:600,color:isPeak?'var(--acc)':'var(--tx2)',textAlign:'right',flexShrink:0}}>{p.year}</span>
                    <div style={{flex:1,height:22,background:'var(--bg)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,background:'var(--acc)',opacity:isPeak?1:0.45,borderRadius:4,transition:'width .4s ease',display:'flex',alignItems:'center',paddingLeft:6}}>
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
        </>
      )}
    </div>
  );
}
