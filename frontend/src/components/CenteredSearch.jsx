/**
 * CenteredSearch — shared landing state component.
 * Shows a Google-style centered search box with icon, subtitle and example chips.
 * Used by Trend, Evolution, Gap, Cluster, Dup panels before first search.
 */
export default function CenteredSearch({
  icon,
  title,
  subtitle,
  placeholder,
  examples = [],
  value,
  onChange,
  onSubmit,
  loading,
  extra,           // extra controls rendered inline inside the search box (select, etc.)
  filter,          // optional filter control rendered as a separate row below the search box
  buttonLabel = 'Analyze',
  accentColor = 'var(--acc)',
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 420, padding: '40px 20px',
      textAlign: 'center',
    }}>
      {/* Icon circle */}
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: accentColor + '18',
        border: `2px solid ${accentColor}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18, fontSize: 28,
      }}>
        {icon}
      </div>

      <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx)', marginBottom: 6 }}>{title}</h2>
      <p style={{ fontSize: 14, color: 'var(--tx2)', maxWidth: 520, lineHeight: 1.6, marginBottom: 28 }}>{subtitle}</p>

      {/* Search box */}
      <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 640 }}>
        <div style={{
          display: 'flex', gap: 8, background: 'var(--surf)',
          border: '2px solid var(--bd)', borderRadius: 14,
          padding: '6px 6px 6px 16px',
          boxShadow: '0 4px 20px rgba(0,0,0,.08)',
          transition: 'border-color .15s, box-shadow .15s',
        }}
          onFocus={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 0 0 4px ${accentColor}18`; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.08)'; }}
        >
          <input
            value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 15, color: 'var(--tx)',
            }}
          />
          {extra}
          <button type="submit" disabled={loading || !value.trim()} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 20px', background: accentColor, color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700,
            cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !value.trim() ? .55 : 1,
            transition: 'opacity .15s',
            whiteSpace: 'nowrap',
          }}>
            {loading
              ? <span style={{ width: 15, height: 15, border: '2px solid #ffffff60', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}/>
              : buttonLabel}
          </button>
        </div>
      </form>

      {/* Filter row — separate from search box */}
      {filter && (
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
          {filter}
        </div>
      )}

      {/* Example chips */}
      {examples.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--tx3)', alignSelf: 'center' }}>Try:</span>
          {examples.map(ex => (
            <button key={ex} onClick={() => onChange(ex)}
              style={{
                padding: '4px 12px', borderRadius: 20,
                border: `1px solid ${accentColor}40`,
                background: accentColor + '10', color: accentColor,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                transition: 'all .13s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = accentColor + '20'; }}
              onMouseLeave={e => { e.currentTarget.style.background = accentColor + '10'; }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
