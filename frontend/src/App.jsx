import { useState, useEffect } from 'react';
import {
  Search, Brain, Shield, BarChart2, Bookmark,
  BookOpen, ChevronRight, Cpu,
  Layers, FileText
} from 'lucide-react';
import SearchPanel          from './components/SearchPanel';
import ResearchIntelligence from './components/ResearchIntelligence';
import ClusterPanel         from './components/ClusterPanel';
import DupPanel             from './components/DupPanel';
import StatsPanel           from './components/StatsPanel';
import SavedPanel           from './components/SavedPanel';
import TopicSummary         from './components/TopicSummary';
import { fetchStats }       from './lib/api';

const NAV = [
  { id:'search',    label:'Search Papers',       icon:Search,      section:'discover' },
  { id:'saved',     label:'Saved Papers',        icon:Bookmark,    section:'discover' },
  { id:'summary',   label:'Topic Summary',       icon:FileText,    section:'analyze'  },
  { id:'intel',     label:'Research Intelligence',icon:Brain,      section:'analyze'  },
  { id:'cluster',   label:'Topic Clusters',      icon:Layers,      section:'analyze'  },
  { id:'dup',       label:'Check My Work',       icon:Shield,      section:'tools'    },
  { id:'stats',     label:'Catalog',             icon:BarChart2,   section:'tools'    },
];

const SECTIONS = [
  { id:'discover', label:'Discover' },
  { id:'analyze',  label:'Analyze'  },
  { id:'tools',    label:'Tools'    },
];

function getSaved() {
  try { return JSON.parse(localStorage.getItem('rp_saved4')||'[]'); } catch { return []; }
}

export default function App() {
  const [page,    setPage]    = useState('search');
  const [query,   setQuery]   = useState('');
  const [saved,   setSaved]   = useState(getSaved);
  const [stats,   setStats]   = useState(null);
  const [sidebar, setSidebar] = useState(true);

  useEffect(()=>{ localStorage.setItem('rp_saved4', JSON.stringify(saved)); }, [saved]);
  useEffect(()=>{ fetchStats().then(setStats).catch(()=>{}); }, []);

  const toggleSave = p =>
    setSaved(prev => prev.some(x=>x.paper_id===p.paper_id)
      ? prev.filter(x=>x.paper_id!==p.paper_id)
      : [...prev, p]);
  const isSaved = id => saved.some(x=>x.paper_id===id);
  const current = NAV.find(n=>n.id===page);

  return (
    <div className={`shell ${sidebar?'':'sidebar-closed'}`}>
      <aside className="sidebar">
        <div className="sb-brand">
          <div className="sb-logo"><Brain size={20}/></div>
          <div>
            <span className="sb-name">ResearchAI</span>
            <span className="sb-sub">For Students &amp; Researchers</span>
          </div>
        </div>

        <nav className="sb-nav">
          {SECTIONS.map(sec=>(
            <div key={sec.id}>
              <p className="sb-section">{sec.label}</p>
              {NAV.filter(n=>n.section===sec.id).map(({id,label,icon:Icon})=>(
                <button key={id} className={`nav-item ${page===id?'active':''}`} onClick={()=>setPage(id)}>
                  <Icon size={15}/>
                  <span>{label}</span>
                  {id==='saved'&&saved.length>0&&<span className="nav-badge">{saved.length}</span>}
                  <span className="nav-dot"/>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {stats&&(
          <div className="sb-index">
            <p className="sb-section">Index</p>
            <div className="sb-pill"><Cpu size={12}/><span>{stats.total_papers.toLocaleString()} papers</span></div>
            <div className="sb-pill"><BookOpen size={12}/><span>{stats.year_min}–{stats.year_max}</span></div>
          </div>
        )}
        <div className="sb-foot">SCImago 2000–2025 · Sentence-BERT</div>
      </aside>

      <div className="main-wrap">
        <header className="topbar">
          <button className="topbar-toggle" onClick={()=>setSidebar(s=>!s)}>
            <ChevronRight size={17} style={{transform:sidebar?'rotate(180deg)':'none',transition:'.2s'}}/>
          </button>
          <div className="breadcrumb">
            <span className="bc-root">ResearchAI</span>
            <ChevronRight size={13} className="bc-sep"/>
            <span className="bc-page">{current?.label}</span>
          </div>
          {page==='search'&&query&&
            <span className="topbar-q">"{query.length>55?query.slice(0,55)+'…':query}"</span>}
          <div className="topbar-right">
            <div className="topbar-user">
              <div className="user-av">R</div>
              <div><div className="user-name">Researcher</div><div className="user-role">Student Mode</div></div>
            </div>
          </div>
        </header>

        <main className="page-wrap">
          {page==='search'  && <SearchPanel    onQuery={setQuery} onSave={toggleSave} isSaved={isSaved}/>}
          {page==='saved'   && <SavedPanel     papers={saved} onRemove={toggleSave}/>}
          {page==='summary' && <TopicSummary   sharedQuery={query}/>}
          {page==='intel'   && <ResearchIntelligence sharedQuery={query}/>}
          {page==='cluster' && <ClusterPanel   sharedQuery={query}/>}
          {page==='dup'     && <DupPanel/>}
          {page==='stats'   && <StatsPanel/>}
        </main>
      </div>
    </div>
  );
}
