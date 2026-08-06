import { useEffect, useState } from 'react';
import { Loader2, BarChart2, BookOpen, MapPin, Info } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchStats } from '../lib/api';

const Q_COLORS = { Q1:'#16a34a', Q2:'#b45309', Q3:'#c2410c', Q4:'#dc2626',
                   '~Q1':'#0e7490','~Q2':'#6d28d9','~Q3':'#be185d','~Q4':'#9f1239' };

export default function StatsPanel() {
  const [data, setData] = useState(null);
  const [load, setLoad] = useState(true);
  const [err,  setErr]  = useState(null);

  useEffect(()=>{
    fetchStats().then(setData).catch(e=>setErr(e.message)).finally(()=>setLoad(false));
  },[]);

  if (load) return <div className="loading"><Loader2 size={18} className="spin"/>Loading catalog…</div>;
  if (err)  return <p className="err">{err}</p>;
  if (!data) return null;

  const realQ   = Object.fromEntries((data.real_quartile_distribution  ||[]).map(r=>[r.quartile, r.count]));
  const approxQ = Object.fromEntries((data.approx_quartile_distribution||[]).map(r=>[r.quartile, r.count]));
  const matched = data.matched_count;
  const unmatched = data.total_papers - matched;

  // Pie data: real quartiles + approx grouped
  const pieData = [
    ...['Q1','Q2','Q3','Q4'].filter(q=>realQ[q]).map(q=>({name:q, value:realQ[q], color:Q_COLORS[q]})),
    {name:'Approx (≈)', value: unmatched, color:'#94a3b8'},
  ];

  const maxQ = Math.max(...Object.values(realQ), ...Object.values(approxQ), 1);

  return (
    <div style={{maxWidth:900}}>
      <div className="ph"><h2>Catalog Overview</h2><p>Full dataset and quartile breakdown</p></div>

      {/* Big stat cards */}
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{data.total_papers.toLocaleString()}</div><div className="stat-lbl">Papers Indexed</div></div>
        <div className="stat-card"><div className="stat-num">{data.year_min}–{data.year_max}</div><div className="stat-lbl">Publication Span</div></div>
        <div className="stat-card"><div className="stat-num">{matched.toLocaleString()}</div><div className="stat-lbl">SCImago Matched</div></div>
        <div className="stat-card"><div className="stat-num">{((matched/data.total_papers)*100).toFixed(1)}%</div><div className="stat-lbl">Match Rate</div></div>
      </div>

      {/* Quartile breakdown */}
      <div className="panel-card">
        <h3><BarChart2 size={16}/>Quartile Distribution</h3>

        <div style={{display:'grid',gridTemplateColumns:'1fr 260px',gap:24,alignItems:'center'}}>
          <div>
            <p style={{fontSize:12,fontWeight:600,color:'var(--tx2)',marginBottom:12}}>Official SCImago Rankings</p>
            {['Q1','Q2','Q3','Q4'].filter(q=>realQ[q]).map(q=>(
              <div key={q} className="qbar-row">
                <span className="qbar-lbl">
                  <span className="qb" style={{background:Q_COLORS[q]+'22',color:Q_COLORS[q],padding:'1px 7px',borderRadius:20,fontSize:11}}>{q}</span>
                </span>
                <div className="qbar-track">
                  <div className={`qbar-fill ${q}`} style={{width:`${((realQ[q]||0)/maxQ)*100}%`}}/>
                </div>
                <span className="qbar-cnt">{(realQ[q]||0).toLocaleString()}</span>
              </div>
            ))}

            <p style={{fontSize:12,fontWeight:600,color:'var(--tx2)',margin:'18px 0 12px',display:'flex',alignItems:'center',gap:6}}>
              <span style={{background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',padding:'1px 7px',borderRadius:20,fontSize:11}}>≈ Approximate</span>
              Citation-percentile estimates (not official)
            </p>
            {['~Q1','~Q2','~Q3','~Q4'].filter(q=>approxQ[q]).map(q=>(
              <div key={q} className="qbar-row">
                <span className="qbar-lbl">
                  <span className="qb" style={{background:Q_COLORS[q]+'22',color:Q_COLORS[q],padding:'1px 7px',borderRadius:20,fontSize:11}}>{q}</span>
                </span>
                <div className="qbar-track">
                  <div className="qbar-fill" style={{width:`${((approxQ[q]||0)/maxQ)*100}%`,background:Q_COLORS[q]}}/>
                </div>
                <span className="qbar-cnt">{(approxQ[q]||0).toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Pie chart */}
          <div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80}
                  dataKey="value" stroke="none">
                  {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip formatter={(v,n)=>[v.toLocaleString(), n]}
                  contentStyle={{background:'#fff',border:'1px solid #e2e8f4',borderRadius:8,fontSize:12}}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center'}}>
              {pieData.map(e=>(
                <div key={e.name} style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}>
                  <div style={{width:8,height:8,borderRadius:2,background:e.color}}/>
                  {e.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="approx-note" style={{marginTop:16,marginBottom:0}}>
          <Info size={14} style={{flexShrink:0}}/>
          <span>
            ~40% of papers are matched to official SCImago rankings. The remaining ~60% are conferences
            or journals outside the CS subject-area file (e.g. ICML, NeurIPS, Remote Sensing, PLoS ONE).
            These receive <strong>approximate ≈ quartiles</strong> estimated from year-normalised citation
            percentile — directional signals only, not official rankings.
          </span>
        </div>
      </div>

      {/* Top venues */}
      <div className="panel-card">
        <h3><MapPin size={16}/>Most Represented Venues</h3>
        <ol style={{listStyle:'none'}}>
          {(data.top_venues||[]).map((v,i)=>(
            <li key={i} className="venue-li">
              <span style={{color:'var(--tx3)',fontSize:12,marginRight:10,width:20,flexShrink:0}}>{i+1}.</span>
              <span style={{flex:1}}>{v.venue}</span>
              <span className="venue-cnt">{Number(v.count).toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </div>

      <p style={{fontSize:11,color:'var(--tx3)',marginTop:8}}>
        Quartile rankings sourced from SCImago Journal &amp; Country Rank (2000–2025).
        Embeddings: Sentence-BERT (all-MiniLM-L6-v2) over title + abstract text.
      </p>
    </div>
  );
}
