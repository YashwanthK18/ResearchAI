import { useState } from 'react';
import { Bookmark, Download, Trash2, ExternalLink } from 'lucide-react';
import QBadge from './QBadge';
import SortSelect from './SortSelect';
import { sortPapers } from '../lib/sort';

function dl(content, type, name) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content],{type})), download: name
  });
  a.click(); URL.revokeObjectURL(a.href);
}

function exportCSV(papers) {
  const h = 'Title,Venue,Year,Citations,Quartile,IsApprox,SJR';
  const rows = papers.map(p =>
    [p.title,p.venue,p.year,p.citations,p.display_quartile,
     p.is_approx?'approx':'official',p.sjr_score??'']
    .map(v=>`"${String(v??'').replace(/"/g,'""')}"`)
    .join(',')
  );
  dl([h,...rows].join('\n'),'text/csv',`saved_papers_${Date.now()}.csv`);
}

function exportBib(papers) {
  const entries = papers.map((p,i) =>
    `@article{paper${i+1},\n  title={${p.title}},\n  journal={${p.venue??''}},\n  year={${p.year??''}},\n}`
  );
  dl(entries.join('\n\n'),'text/plain',`saved_papers_${Date.now()}.bib`);
}

export default function SavedPanel({ papers, onRemove }) {
  const [sortBy, setSortBy] = useState('relevance');

  if (!papers.length) return (
    <div className="saved-empty">
      <Bookmark size={44} color="var(--tx3)"/>
      <h3>No saved papers yet</h3>
      <p>Click the bookmark icon on any result card to save papers here.</p>
    </div>
  );

  return (
    <div>
      <div className="ph">
        <h2>Saved Papers</h2>
        <p>{papers.length} paper{papers.length!==1?'s':''} saved</p>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:20,alignItems:'center',flexWrap:'wrap'}}>
        <button className="btn btn-ghost" onClick={()=>exportCSV(papers)}><Download size={13}/>Export CSV</button>
        <button className="btn btn-ghost" onClick={()=>exportBib(papers)}><Download size={13}/>Export BibTeX</button>
        <div style={{flex:1}}/>
        <SortSelect value={sortBy} onChange={setSortBy}
          options={[{value:'relevance',label:'Saved order'},{value:'year_desc',label:'Newest first'},{value:'year_asc',label:'Oldest first'},{value:'citations',label:'Most cited'},{value:'quartile',label:'Best quartile'},{value:'title',label:'Title (A-Z)'}]}/>
      </div>

      <div className="plist">
        {sortPapers(papers, sortBy).map((p,i)=>(
          <article key={p.paper_id||i} className="pc">
            <div className="pc-num">{i+1}</div>
            <div className="pc-body">
              <div className="pc-top">
                <QBadge quartile={p.quartile} approxQuartile={p.approx_quartile} isApprox={p.is_approx}/>
                <div style={{flex:1}}/>
                <button className="pc-btn" onClick={()=>onRemove(p)} title="Remove">
                  <Trash2 size={13}/> Remove
                </button>
              </div>
              <h3 className="pc-title">
                <a href={`https://www.google.com/search?q=${encodeURIComponent((p.title||'')+' research paper')}`}
                   target="_blank" rel="noreferrer">{p.title}</a>
              </h3>
              <p className="pc-venue"><ExternalLink size={11}/>{p.venue}{p.year?`, ${p.year}`:''}</p>
              <p className="pc-abs">{(p.abstract||'').slice(0,250)}{(p.abstract||'').length>250?'…':''}</p>
              <div className="pc-meta">
                <span>{(p.citations||0).toLocaleString()} citations</span>
                {p.sjr_score!=null&&<span>SJR {p.sjr_score.toFixed(2)}</span>}
                {p.is_approx&&<span className="tag tag-approx">≈ estimated</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
