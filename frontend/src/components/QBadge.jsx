export default function QBadge({ quartile, approxQuartile, isApprox, size = 'sm' }) {
  const display = (quartile && quartile !== 'Unknown') ? quartile : (approxQuartile || 'Unknown');
  const approx  = isApprox || (quartile === 'Unknown' && approxQuartile);

  // CSS class: real = Q1/Q2/Q3/Q4/Unknown, approx = approx-q1 etc.
  let cls = display;
  if (approx && display.startsWith('~')) {
    cls = 'approx-' + display.replace('~','').toLowerCase(); // ~Q1 -> approx-q1
  }

  const label = approx ? display : display;

  return (
    <span className={`qb ${cls}`} title={approx ? 'Approximate quartile (citation-based estimate — not from SCImago)' : 'Official SCImago quartile'}>
      {approx && <span style={{opacity:.7,fontSize:'9px',marginRight:2}}>≈</span>}
      {label}
    </span>
  );
}
