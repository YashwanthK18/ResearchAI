import { useState, useRef } from 'react';
import { Search, Upload, Loader2, Bookmark, BookmarkCheck,
         Download, ExternalLink, ChevronDown, ChevronUp,
         Layers, AlertCircle, Brain } from 'lucide-react';
import { searchPapers, searchByPdf } from '../lib/api';
import { sortPapers } from '../lib/sort';
import QBadge from './QBadge';
import SortSelect from './SortSelect';
import SimilarModal from './SimilarModal';
import ApproxDisclaimer from './ApproxDisclaimer';

const QS = ['Q1','Q2','Q3','Q4'];
const KS = [10, 20, 50];

function dl(content, type, name) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type })), download: name,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

function exportCSV(papers) {
  const h = 'Title,Venue,Year,Citations,Quartile,IsApprox,SJR,Similarity';
  const rows = papers.map(p =>
    [p.title, p.venue, p.year, p.citations,
     p.display_quartile, p.is_approx ? 'approx' : 'official',
     p.sjr_score ?? '', ((p.similarity||0)*100).toFixed(1)+'%']
    .map(v => `"${String(v??'').replace(/"/g,'""')}"`)
    .join(',')
  );
  dl([h, ...rows].join('\n'), 'text/csv', `papers_${Date.now()}.csv`);
}

function exportBib(papers) {
  const entries = papers.map((p, i) =>
    `@article{paper${i+1},\n  title={${p.title}},\n  journal={${p.venue??''}},\n  year={${p.year??''}},\n}`
  );
  dl(entries.join('\n\n'), 'text/plain', `papers_${Date.now()}.bib`);
}

// Citation generator
function makeCitation(paper, style) {
  const title   = paper.title || 'Untitled';
  const venue   = paper.venue || 'Unknown Venue';
  const year    = paper.year  || 'n.d.';
  if (style === 'APA')
    return `Author(s). (${year}). ${title}. ${venue}.`;
  if (style === 'IEEE')
    return `Author(s), "${title}," ${venue}, ${year}.`;
  if (style === 'MLA')
    return `Author(s). "${title}." ${venue} (${year}).`;
  return '';
}

export default function SearchPanel({ onQuery, onSave, isSaved }) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [qfilter,     setQfilter]     = useState([]);
  const [ymin,        setYmin]        = useState('');
  const [ymax,        setYmax]        = useState('');
  const [mincit,      setMincit]      = useState('');
  const [topk,        setTopk]        = useState(10);
  const [mode,        setMode]        = useState('text');
  const [pdfName,     setPdfName]     = useState(null);
  const [expOpen,     setExpOpen]     = useState(false);
  const [simPaper,    setSimPaper]    = useState(null);
  const [scimagoOnly, setScimagoOnly] = useState(false);
  const [sortBy,      setSortBy]      = useState('relevance');
  const fileRef = useRef();

  const toggleQ = q => setQfilter(p => p.includes(q) ? p.filter(x => x !== q) : [...p, q]);

  async function run(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(null); setPdfName(null);
    try {
      const d = await searchPapers({
        query, top_k: topk,
        min_year: ymin ? +ymin : undefined,
        max_year: ymax ? +ymax : undefined,
        quartiles: qfilter.length ? qfilter : undefined,
        min_citations: mincit ? +mincit : undefined,
        scimago_only: scimagoOnly,
      });
      setResults(d); onQuery?.(query);
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function runPdf(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true); setError(null); setPdfName(file.name);
    try {
      const d = await searchByPdf(file, topk);
      setResults(d); setQuery(d.query); onQuery?.(d.query);
    } catch(err) { setError(err.message); }
    finally { setLoading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  const approxCount = results?.results?.filter(r => r.is_approx).length || 0;
  const hasApprox   = approxCount > 0;

  // Landing state — before any search
  if (!results && !loading && !error) {
    return (
      <div style={{ maxWidth: 1160 }}>
        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg, #4f6ef712, #9333ea08)',
          border: '1px solid #4f6ef720',
          borderRadius: 'var(--r)',
          padding: '36px 32px',
          marginBottom: 24,
          display: 'flex', gap: 32, alignItems: 'center',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 42, height: 42, background: 'var(--acc)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={22} color="#fff"/>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx)' }}>Semantic Research Discovery</div>
                <div style={{ fontSize: 13, color: 'var(--tx2)' }}>165,387 Computer Science papers · Meaning-based search</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: 'var(--tx2)', lineHeight: 1.7, maxWidth: 600 }}>
              Unlike keyword search, this finds papers by <strong>meaning</strong> — so "privacy-preserving distributed training" finds federated learning papers even without those exact words.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flexShrink: 0 }}>
            {[
              { icon: '🔍', label: 'Semantic Search' },
              { icon: '📎', label: 'PDF Upload' },
              { icon: '🏅', label: 'SCImago Quartiles' },
              { icon: '💾', label: 'Save & Export' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', fontSize: 12, fontWeight: 600, color: 'var(--tx2)' }}>
                <span>{f.icon}</span>{f.label}
              </div>
            ))}
          </div>
        </div>

        {/* Search area */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
          <div>
            {/* Mode tabs */}
            <div className="mtabs">
              <button className={`mtab ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')}>
                <Search size={13}/> Text Search
              </button>
              <button className={`mtab ${mode === 'pdf' ? 'active' : ''}`} onClick={() => setMode('pdf')}>
                <Upload size={13}/> Upload PDF
              </button>
            </div>

            {mode === 'text' ? (
              <>
                <form className="sbar" onSubmit={run} style={{ marginBottom: 14 }}>
                  <Search size={16} className="sbar-ico"/>
                  <input placeholder='"transformer models for medical image analysis"'
                    value={query} onChange={e => setQuery(e.target.value)}/>
                  <button className="btn btn-acc" disabled={loading || !query.trim()}>
                    {loading ? <Loader2 size={14} className="spin"/> : 'Search →'}
                  </button>
                </form>
                {/* Example queries */}
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--tx3)', alignSelf: 'center' }}>Try:</span>
                  {['deep learning for medical imaging', 'federated learning privacy', 'graph neural networks', 'object detection YOLO'].map(ex => (
                    <button key={ex} onClick={() => setQuery(ex)}
                      style={{ padding: '3px 10px', borderRadius: 20, border: '1px solid #4f6ef740', background: '#4f6ef710', color: 'var(--acc)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                      {ex}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="pdf-drop" onClick={() => fileRef.current?.click()}>
                <Upload size={28} color="var(--acc)"/>
                <h4>{pdfName || 'Click to upload your research proposal PDF'}</h4>
                <p>We extract text and find semantically similar papers</p>
                <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={runPdf}/>
              </div>
            )}
            {error && <p className="err">{error}</p>}
          </div>

          {/* Filters shown even on landing */}
          <FilterCard
            qfilter={qfilter} toggleQ={toggleQ}
            ymin={ymin} setYmin={setYmin}
            ymax={ymax} setYmax={setYmax}
            mincit={mincit} setMincit={setMincit}
            topk={topk} setTopk={setTopk}
            scimagoOnly={scimagoOnly} setScimagoOnly={setScimagoOnly}
            onReset={() => { setQfilter([]); setYmin(''); setYmax(''); setTopk(10); setMincit(''); setScimagoOnly(false); }}
            onApply={run} loading={loading} hasQuery={!!query.trim() || !!pdfName}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1160 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
        <div>
          {/* Compact search bar after results */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div className="mtabs" style={{ marginBottom: 0 }}>
              <button className={`mtab ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')}><Search size={13}/></button>
              <button className={`mtab ${mode === 'pdf' ? 'active' : ''}`} onClick={() => setMode('pdf')}><Upload size={13}/></button>
            </div>
            {mode === 'text' ? (
              <form className="sbar" onSubmit={run} style={{ flex: 1 }}>
                <Search size={15} className="sbar-ico"/>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="New search..."/>
                <button className="btn btn-acc" disabled={loading}>{loading ? <Loader2 size={14} className="spin"/> : '→'}</button>
              </form>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="pdf-drop" style={{ flex: 1, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => fileRef.current?.click()}>
                  <Upload size={14}/> {pdfName || 'Upload PDF'}
                  <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={runPdf}/>
                </div>
              </div>
            )}
          </div>

          {error && <p className="err">{error}</p>}
          {loading && <div className="loading"><Loader2 size={18} className="spin"/>Searching…</div>}

          {results && !loading && (
            <>
              {/* Results header */}
              <div className="rh">
                <p className="rcount">
                  <strong>{results.count}</strong> results for{' '}
                  <em>"{results.query.length > 60 ? results.query.slice(0,60)+'…' : results.query}"</em>
                  {scimagoOnly && <span style={{ marginLeft: 8, fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>SCImago only</span>}
                </p>
                <div className="ract">
                  <SortSelect value={sortBy} onChange={setSortBy}/>
                  <div className="exp-wrap">
                    <button className="btn btn-ghost" onClick={() => setExpOpen(s => !s)}>
                      <Download size={13}/> Export {expOpen ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
                    </button>
                    {expOpen && (
                      <div className="exp-menu">
                        <button onClick={() => { exportCSV(results.results); setExpOpen(false); }}>Export CSV</button>
                        <button onClick={() => { exportBib(results.results); setExpOpen(false); }}>Export BibTeX</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              {hasApprox && !scimagoOnly && (
                <ApproxDisclaimer count={approxCount} total={results.count}/>
              )}

              {/* Results list */}
              <div className="plist">
                {sortPapers(results.results, sortBy).map((paper, i) => (
                  <PaperCard key={paper.paper_id || i} paper={paper} rank={i+1}
                    saved={isSaved?.(paper.paper_id)}
                    onSave={() => onSave?.(paper)}
                    onSimilar={() => setSimPaper(paper)}
                  />
                ))}
                {results.results.length === 0 && (
                  <div className="empty">No papers matched those filters — try widening the year range or removing quartile filters.</div>
                )}
              </div>
            </>
          )}
        </div>

        <FilterCard
          qfilter={qfilter} toggleQ={toggleQ}
          ymin={ymin} setYmin={setYmin}
          ymax={ymax} setYmax={setYmax}
          mincit={mincit} setMincit={setMincit}
          topk={topk} setTopk={setTopk}
          scimagoOnly={scimagoOnly} setScimagoOnly={setScimagoOnly}
          onReset={() => { setQfilter([]); setYmin(''); setYmax(''); setTopk(10); setMincit(''); setScimagoOnly(false); }}
          onApply={run} loading={loading} hasQuery={!!query.trim() || !!pdfName}
        />
      </div>

      {simPaper && <SimilarModal paper={simPaper} onClose={() => setSimPaper(null)}/>}
    </div>
  );
}

function FilterCard({ qfilter, toggleQ, ymin, setYmin, ymax, setYmax, mincit, setMincit, topk, setTopk, scimagoOnly, setScimagoOnly, onReset, onApply, loading, hasQuery }) {
  return (
    <aside>
      <div className="fc">
        <div className="fc-head">
          <span>Filters</span>
          <button className="btn-link" onClick={onReset}>Reset</button>
        </div>

        <div className="fc-sec">
          <label className="fc-lbl">Quartile Source</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="radio" name="qsource" checked={!scimagoOnly} onChange={() => setScimagoOnly(false)}/>
              <span>All papers <span style={{ fontSize: 11, color: 'var(--tx3)' }}>(official + ≈ approx)</span></span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="radio" name="qsource" checked={scimagoOnly} onChange={() => setScimagoOnly(true)}/>
              <span>Official SCImago only <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ exact</span></span>
            </label>
          </div>
        </div>

        <div className="fc-sec">
          <label className="fc-lbl">Year Range</label>
          <div className="yr-row">
            <input className="yr-inp" type="number" placeholder="From" value={ymin} onChange={e => setYmin(e.target.value)}/>
            <span style={{ color: 'var(--tx3)' }}>–</span>
            <input className="yr-inp" type="number" placeholder="To" value={ymax} onChange={e => setYmax(e.target.value)}/>
          </div>
        </div>

        <div className="fc-sec">
          <label className="fc-lbl">Quartile (incl. approx)</label>
          <div className="qchips">
            {QS.map(q => (
              <button key={q} className={`qchip ${q} ${qfilter.includes(q) ? 'on' : ''}`} onClick={() => toggleQ(q)}>{q}</button>
            ))}
          </div>
        </div>

        <div className="fc-sec">
          <label className="fc-lbl">Min Citations</label>
          <input className="cit-inp" type="number" placeholder="e.g. 50"
            value={mincit} onChange={e => setMincit(e.target.value)}/>
        </div>

        <div className="fc-sec">
          <label className="fc-lbl">Results to show</label>
          <div className="topk">
            {KS.map(k => (
              <button key={k} className={`topk-b ${topk === k ? 'on' : ''}`} onClick={() => setTopk(k)}>{k}</button>
            ))}
          </div>
        </div>

        <button className="btn btn-acc btn-full" onClick={onApply}
          disabled={loading || !hasQuery}>
          {loading ? <Loader2 size={14} className="spin"/> : 'Apply Filters'}
        </button>
      </div>
    </aside>
  );
}

function PaperCard({ paper, rank, saved, onSave, onSimilar }) {
  const [expanded, setExpanded]   = useState(false);
  const [citStyle, setCitStyle]   = useState(null);
  const [copied,   setCopied]     = useState(false);
  const abs = paper.abstract || '';

  function copyCitation(style) {
    const text = makeCitation(paper, style);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setCitStyle(style);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <article className="pc">
      <div className="pc-num">{rank}</div>
      <div className="pc-body">
        <div className="pc-top" style={{ flexWrap: 'wrap', gap: 6 }}>
          <QBadge quartile={paper.quartile} approxQuartile={paper.approx_quartile} isApprox={paper.is_approx}/>
          <span className="sim-badge">{((paper.similarity||0)*100).toFixed(1)}% match</span>
          <div style={{ flex: 1 }}/>
          <button className={`pc-btn ${saved ? 'save-on' : ''}`} onClick={onSave}>
            {saved ? <BookmarkCheck size={13}/> : <Bookmark size={13}/>}
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>

        <h3 className="pc-title">
          <a href={`https://www.google.com/search?q=${encodeURIComponent((paper.title||'')+' research paper')}`}
            target="_blank" rel="noreferrer">{paper.title}</a>
        </h3>

        <p className="pc-venue">
          <ExternalLink size={11}/>
          {paper.venue}{paper.year ? `, ${paper.year}` : ''}
        </p>

        <p className="pc-abs">
          {expanded ? abs : abs.slice(0, 220)}
          {abs.length > 220 && (
            <button className="exp-btn" onClick={() => setExpanded(s => !s)}>
              {expanded ? ' show less' : '… read more'}
            </button>
          )}
        </p>

        <div className="pc-meta">
          <span>{(paper.citations||0).toLocaleString()} citations</span>
          {paper.sjr_score != null && <><span className="pc-meta-sep">·</span><span>SJR {paper.sjr_score.toFixed(2)}</span></>}
          {paper.h_index   != null && <><span className="pc-meta-sep">·</span><span>H-index {Math.round(paper.h_index)}</span></>}
          {paper.is_approx && <><span className="pc-meta-sep">·</span><span className="tag tag-approx">≈ estimated quartile</span></>}
        </div>

        <div className="pc-actions">
          <button className="pc-btn" onClick={onSimilar}><Layers size={13}/> Find Similar</button>
          <button className="pc-btn" onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent((paper.title||'')+' research paper')}`, '_blank')}>
            <ExternalLink size={13}/> Open Paper
          </button>
          {/* Quick cite buttons */}
          {['APA','IEEE','MLA'].map(style => (
            <button key={style} className="pc-btn"
              style={copied && citStyle === style ? { background: '#dcfce7', borderColor: '#16a34a', color: '#15803d' } : {}}
              onClick={() => copyCitation(style)}>
              {copied && citStyle === style ? '✓ Copied' : `Cite ${style}`}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}


