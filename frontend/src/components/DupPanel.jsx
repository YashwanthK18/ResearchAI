import { useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle, ExternalLink, Info } from 'lucide-react';
import { fetchCheckDuplicate } from '../lib/api';
import { sortPapers } from '../lib/sort';
import QBadge from './QBadge';
import SortSelect from './SortSelect';

const THRESHOLD_OPTIONS = [
  { label: 'Very strict (85%+)', value: 0.85 },
  { label: 'Strict (75%+)',      value: 0.75 },
  { label: 'Standard (70%+)',    value: 0.70 },
  { label: 'Broad (60%+)',       value: 0.60 },
];

const simColor = s => s>=0.85?'#dc2626':s>=0.75?'#ea580c':s>=0.60?'#ca8a04':'#16a34a';
const simLabel = s => s>=0.85?'Near-identical — very likely duplicate':s>=0.75?'Same topic — closely related':s>=0.60?'Broadly related — same sub-field':'Low — probably just related';

export default function DupPanel() {
  const [text,      setText]      = useState('');
  const [threshold, setThreshold] = useState(0.70);
  const [topK,      setTopK]      = useState(15);
  const [data,      setData]      = useState(null);
  const [load,      setLoad]      = useState(false);
  const [err,       setErr]       = useState(null);
  const [sortBy,    setSortBy]    = useState('relevance');

  async function run(e) {
    e?.preventDefault();
    if (!text.trim()) return;
    if (text.trim().length < 50) {
      setErr('Please provide more text — paste your full title and abstract for best results.');
      return;
    }
    setLoad(true); setErr(null); setData(null);
    try { setData(await fetchCheckDuplicate(text, topK, threshold)); }
    catch(e) { setErr(e.message || 'Unknown error'); }
    finally { setLoad(false); }
  }

  return (
    <div style={{maxWidth:860}}>
      <div className="ph">
        <h2>Check My Work</h2>
        <p>Paste your research title and abstract to find existing papers similar to your idea</p>
      </div>

      {/* How it works */}
      <div className="approx-note" style={{marginBottom:20,background:'#eff6ff',border:'1px solid #bfdbfe',color:'#1e40af'}}>
        <Info size={15} style={{flexShrink:0,marginTop:1}}/>
        <div style={{fontSize:12}}>
          <strong>How this works:</strong> Paste your research title + abstract below.
          The system converts your text into the same semantic embedding space (Sentence-BERT) as the indexed papers
          and finds the most similar ones. Read the papers returned and judge for yourself —
          similarity alone doesn't mean duplication.
        </div>
      </div>

      <form onSubmit={run}>
        <div className="panel-card" style={{marginBottom:14}}>
          <label className="fc-lbl">Your Research Title + Abstract</label>
          <textarea
            value={text} onChange={e=>setText(e.target.value)}
            placeholder={"Paste your full title and abstract here...\n\nExample:\nTitle: Privacy-Preserving Federated Learning for IoT Devices\nAbstract: We propose a novel approach to federated learning that preserves user privacy in IoT environments by applying differential privacy mechanisms at the edge device level..."}
            style={{width:'100%',minHeight:180,padding:'10px 12px',border:'1.5px solid var(--bd)',borderRadius:'var(--rs)',fontSize:13,fontFamily:'inherit',resize:'vertical',outline:'none',background:'var(--bg)',color:'var(--tx)',lineHeight:1.6}}
            onFocus={e=>e.target.style.borderColor='var(--acc)'}
            onBlur={e=>e.target.style.borderColor='var(--bd)'}
          />
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
            <span style={{fontSize:11,color:text.length<50?'#dc2626':'var(--tx3)'}}>
              {text.length} characters {text.length<50?'— need at least 50 for a meaningful search':''}
            </span>
            <span style={{fontSize:11,color:'var(--tx3)'}}>More text = better results</span>
          </div>
        </div>

        <div style={{display:'flex',gap:12,marginBottom:14,flexWrap:'wrap'}}>
          <div style={{background:'var(--surf)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:'12px 14px',flex:1,minWidth:200}}>
            <label className="fc-lbl">Similarity Threshold</label>
            <select value={threshold} onChange={e=>setThreshold(+e.target.value)}
              style={{width:'100%',padding:'7px 9px',border:'1.5px solid var(--bd)',borderRadius:'var(--rs)',fontSize:13,background:'var(--bg)'}}>
              {THRESHOLD_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p style={{fontSize:11,color:'var(--tx3)',marginTop:5}}>
              70%+ is a reasonable default for "same topic" — see the SCImago-scale explanation above
            </p>
          </div>
          <div style={{background:'var(--surf)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:'12px 14px',flex:1,minWidth:160}}>
            <label className="fc-lbl">Results to Show</label>
            <div className="topk">
              {[5,10,15].map(k=>(
                <button key={k} type="button" className={`topk-b ${topK===k?'on':''}`} onClick={()=>setTopK(k)}>{k}</button>
              ))}
            </div>
          </div>
        </div>

        <button className="btn btn-acc" type="submit" disabled={load||text.trim().length<50}
          style={{width:'100%',justifyContent:'center',padding:'12px',fontSize:14}}>
          {load ? <><Loader2 size={15} className="spin"/> Checking against {'\u2248'}99k papers…</> : '🔍 Check My Research'}
        </button>
      </form>

      {err && <p className="err" style={{marginTop:14}}>{err}</p>}
      {load && <div className="loading" style={{marginTop:20}}><Loader2 size={18} className="spin"/>Searching…</div>}

      {data && !load && (
        <div style={{marginTop:24}}>
          {/* Summary banner */}
          {data.fallback ? (
            <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:'var(--r)',padding:'14px 18px',display:'flex',gap:10,marginBottom:20}}>
              <CheckCircle size={20} color="#16a34a" style={{flexShrink:0}}/>
              <div>
                <div style={{fontWeight:700,color:'#15803d'}}>No highly similar papers found above threshold</div>
                <div style={{fontSize:12,color:'#166534',marginTop:2}}>
                  Showing top 5 most similar papers for reference — these appear to be related work rather than duplicates. Your research idea looks reasonably novel at this threshold.
                </div>
              </div>
            </div>
          ) : (
            <div style={{background:'#fefce8',border:'1px solid #fde047',borderRadius:'var(--r)',padding:'14px 16px',display:'flex',gap:10,marginBottom:20}}>
              <AlertTriangle size={18} color="#ca8a04" style={{flexShrink:0,marginTop:1}}/>
              <div>
                <div style={{fontWeight:700,color:'#92400e'}}>{data.count} similar paper{data.count!==1?'s':''} found above {(threshold*100).toFixed(0)}% threshold</div>
                <div style={{fontSize:12,color:'#78350f',marginTop:2}}>{data.warning}</div>
              </div>
            </div>
          )}

          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <SortSelect value={sortBy} onChange={setSortBy}
              options={[{value:'relevance',label:'Most similar'},{value:'year_desc',label:'Newest first'},{value:'year_asc',label:'Oldest first'},{value:'citations',label:'Most cited'},{value:'quartile',label:'Best quartile'},{value:'title',label:'Title (A-Z)'}]}/>
          </div>

          <div className="plist">
            {sortPapers(data.results, sortBy).map((paper,i)=>(
              <article key={paper.paper_id||i} className="pc">
                <div className="pc-num">{i+1}</div>
                <div className="pc-body">
                  <div className="pc-top" style={{flexWrap:'wrap',gap:6}}>
                    <QBadge quartile={paper.quartile} approxQuartile={paper.approx_quartile} isApprox={paper.is_approx}/>
                    <span style={{display:'inline-flex',alignItems:'center',padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:simColor(paper.similarity)+'18',color:simColor(paper.similarity),border:`1px solid ${simColor(paper.similarity)}44`}}>
                      {(paper.similarity*100).toFixed(1)}% similar
                    </span>
                    <span style={{fontSize:11,color:simColor(paper.similarity),fontWeight:500}}>— {simLabel(paper.similarity)}</span>
                  </div>
                  <h3 className="pc-title">
                    <a href={`https://www.google.com/search?q=${encodeURIComponent((paper.title||'')+' research paper')}`} target="_blank" rel="noreferrer">{paper.title}</a>
                  </h3>
                  <p className="pc-venue"><ExternalLink size={11}/>{paper.venue}{paper.year?`, ${paper.year}`:''}</p>
                  <p className="pc-abs">{(paper.abstract||'').slice(0,280)}{(paper.abstract||'').length>280?'…':''}</p>
                  <div className="pc-meta">
                    <span>{(paper.citations||0).toLocaleString()} citations</span>
                    {paper.sjr_score!=null&&<><span className="pc-meta-sep">·</span><span>SJR {paper.sjr_score.toFixed(2)}</span></>}
                    {paper.is_approx&&<><span className="pc-meta-sep">·</span><span className="tag tag-approx">≈ estimated</span></>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
