export default function ScimagoToggle({ value, onChange }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--surf)',border:'1px solid var(--bd)',borderRadius:10,padding:'5px 6px',boxShadow:'0 2px 8px rgba(0,0,0,.05)'}}>
      <span style={{fontSize:11.5,color:'var(--tx3)',fontWeight:600,padding:'0 6px',whiteSpace:'nowrap'}}>Show:</span>
      <button onClick={()=>onChange(false)} style={{padding:'6px 13px',borderRadius:7,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .13s',background:!value?'var(--acc)':'transparent',color:!value?'#fff':'var(--tx2)'}}>
        All papers
      </button>
      <button onClick={()=>onChange(true)} style={{padding:'6px 13px',borderRadius:7,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .13s',background:value?'#16a34a':'transparent',color:value?'#fff':'var(--tx2)'}}>
        ✓ SCImago only
      </button>
    </div>
  );
}
