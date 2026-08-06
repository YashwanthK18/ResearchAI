import { useState, useEffect } from 'react';
import {
  Search, Brain, Shield, BarChart2, Bookmark,
  BookOpen, ChevronRight, Cpu,
  Layers, FileText, Sun, Moon, Monitor
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

function getInitialTheme() {
  try { return localStorage.getItem('rp_theme') || 'system'; } catch { return 'system'; }
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export default function App() {
  const [page,    setPage]    = useState('search');
  const [query,   setQuery]   = useState('');
  const [saved,   setSaved]   = useState(getSaved);
  const [stats,   setStats]   = useState(null);
  const [sidebar, setSidebar] = useState(true);
  const [theme,   setTheme]   = useState(getInitialTheme);

  useEffect(()=>{ localStorage.setItem('rp_saved4', JSON.stringify(saved)); }, [saved]);
  useEffect(()=>{ fetchStats().then(setStats).catch(()=>{}); }, []);

  // Apply theme + listen for system preference changes
  useEffect(()=>{
    applyTheme(theme);
    localStorage.setItem('rp_theme', theme);
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

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

        {/* Theme switcher */}
        <div className="sb-theme">
          <p className="sb-section" style={{marginBottom:6}}>Appearance</p>
          <div style={{display:'flex',gap:4}}>
            {[
              { val:'light',  icon:<Sun size={12}/>,     label:'Light'  },
              { val:'system', icon:<Monitor size={12}/>, label:'System' },
              { val:'dark',   icon:<Moon size={12}/>,    label:'Dark'   },
            ].map(({val,icon,label})=>(
              <button key={val} onClick={()=>setTheme(val)}
                title={label}
                style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,
                  padding:'6px 4px',borderRadius:6,border:'none',cursor:'pointer',fontSize:9,fontWeight:600,
                  transition:'all .15s',
                  background: theme===val ? 'var(--sb-act-bg)' : 'transparent',
                  color: theme===val ? '#4f6ef7' : 'var(--sb-tx)',
                  outline: theme===val ? '1px solid #4f6ef740' : 'none',
                }}>
                {icon}{label}
              </button>
            ))}
          </div>
        </div>

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
              <div><div className="user-name">Researcher</div></div>
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
