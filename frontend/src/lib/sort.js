// Shared sorting logic for any paper-list result set across the app.

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'year_desc',  label: 'Newest first' },
  { value: 'year_asc',   label: 'Oldest first' },
  { value: 'citations',  label: 'Most cited' },
  { value: 'quartile',   label: 'Best quartile' },
  { value: 'title',      label: 'Title (A-Z)' },
];

const Q_RANK = { Q1: 0, '~Q1': 0.5, Q2: 1, '~Q2': 1.5, Q3: 2, '~Q3': 2.5, Q4: 3, '~Q4': 3.5 };

function quartileRank(p) {
  const q = p.display_quartile || p.quartile || p.approx_quartile;
  return Q_RANK[q] ?? 9;
}

export function sortPapers(papers, sortBy) {
  if (!papers?.length || !sortBy || sortBy === 'relevance') return papers;
  const arr = [...papers];
  switch (sortBy) {
    case 'year_desc':  return arr.sort((a,b) => (b.year||0) - (a.year||0));
    case 'year_asc':   return arr.sort((a,b) => (a.year||0) - (b.year||0));
    case 'citations':  return arr.sort((a,b) => (b.citations||0) - (a.citations||0));
    case 'quartile':   return arr.sort((a,b) => quartileRank(a) - quartileRank(b));
    case 'title':      return arr.sort((a,b) => (a.title||'').localeCompare(b.title||''));
    default:           return arr;
  }
}
