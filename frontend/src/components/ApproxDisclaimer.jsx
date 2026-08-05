/**
 * ApproxDisclaimer — shown once per page where approximate quartiles appear.
 * Satisfies the paper requirement: "explicitly identified within the web 
 * interface using appropriate disclaimers"
 */
export default function ApproxDisclaimer({ count, total }) {
  return (
    <div style={{
      background: '#fffbeb',
      border: '1px solid #fde68a',
      borderLeft: '4px solid #f59e0b',
      borderRadius: 'var(--rs)',
      padding: '10px 14px',
      marginBottom: 16,
      fontSize: 12,
      color: '#78350f',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
      <div>
        <strong>Approximate Quartile Disclaimer: </strong>
        {count !== undefined && total !== undefined
          ? `${count} of ${total} papers`
          : 'Some papers'}
        {' '}show <strong>≈Q1–≈Q4</strong> labels — these are{' '}
        <strong>estimated rankings</strong> based on year-normalised citation
        percentile, <strong>not official SCImago data</strong>. They provide a
        directional signal only (59.4% accuracy vs official rankings). Papers
        with official SCImago matches show <strong>Q1–Q4</strong> without the ≈
        symbol. Use the{' '}
        <strong>"SCImago Only" filter</strong> in Search to restrict results to
        officially ranked papers.
      </div>
    </div>
  );
}
