import { ArrowUpDown } from 'lucide-react';
import { SORT_OPTIONS } from '../lib/sort';

export default function SortSelect({ value, onChange, options = SORT_OPTIONS }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--surf)', border: '1px solid var(--bd)',
      borderRadius: 8, padding: '5px 10px',
    }}>
      <ArrowUpDown size={12} color="var(--tx3)"/>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 600, color: 'var(--tx2)', cursor: 'pointer' }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
