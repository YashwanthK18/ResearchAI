"""
enrich_with_core.py
====================
Improves quartile estimation for "Unknown" papers using a composite
quality score built from ALL available signals:

  1. CORE journal rank (A*/A/B/C) — venue prestige
  2. Citation count — normalized within same year (age-adjusted impact)
  3. SJR score — journal impact (where available)
  4. H-index of venue — journal influence
  5. Paper age — older papers had more time to accumulate citations

The composite score (0–100) is then bucketed into ~Q1/~Q2/~Q3/~Q4.
Papers already matched by SCImago keep their official quartile unchanged.

Run from backend/:
    python scripts/enrich_with_core.py

This overwrites data/cse_papers_with_quartiles.jsonl in place.
Then re-run: python scripts/rebuild_embeddings.py
"""

import json, re, math
import pandas as pd
import numpy as np
from pathlib import Path
from rapidfuzz import process, fuzz
from collections import defaultdict

BASE     = Path(__file__).resolve().parents[1]
DATA     = BASE / "data"
RAW      = DATA / "raw"
ENRICHED = DATA / "cse_papers_with_quartiles.jsonl"

# ── CORE rank → numeric prestige score ───────────────────────────────────────
CORE_SCORE = {"A*": 100, "A": 75, "B": 50, "C": 25}
CORE_TO_Q  = {"A*": "~Q1", "A": "~Q1", "B": "~Q2", "C": "~Q3"}

# Fuzzy match threshold for venue name matching
FUZZY_THRESHOLD = 82

# ── Load & merge CORE files ───────────────────────────────────────────────────
def load_core():
    files = list(RAW.glob("CORE_journals*.csv"))
    if not files:
        print("No CORE CSV files found in data/raw/. Skipping CORE matching.")
        return {}

    dfs = []
    for f in files:
        try:
            df = pd.read_csv(f, encoding="utf-8", on_bad_lines="skip")
            dfs.append(df)
        except Exception as e:
            print(f"Warning: could not load {f}: {e}")

    combined = pd.concat(dfs).drop_duplicates(subset="title")
    valid    = combined[combined["rank"].isin(CORE_SCORE.keys())].copy()
    valid["title_clean"] = valid["title"].str.lower().str.strip()
    print(f"Loaded {len(valid)} CORE journal entries (A*/A/B/C) from {len(files)} file(s)")
    print(f"  A*: {(valid['rank']=='A*').sum()}  A: {(valid['rank']=='A').sum()}  "
          f"B: {(valid['rank']=='B').sum()}  C: {(valid['rank']=='C').sum()}")
    return dict(zip(valid["title_clean"], valid["rank"]))

def clean_venue(v):
    if not v: return ""
    v = str(v).lower().strip()
    v = re.sub(r"\b(proceedings of( the)?|international (conference|journal|symposium|workshop) on( the)?|"
               r"annual|journal of( the)?|transactions on|ieee|acm|springer)\b", " ", v)
    return re.sub(r"\s+", " ", v).strip()

def match_core(venue, core_map, core_keys):
    if not venue: return None
    v = clean_venue(venue)
    if v in core_map: return core_map[v]
    res = process.extractOne(v, core_keys, scorer=fuzz.token_sort_ratio,
                             score_cutoff=FUZZY_THRESHOLD)
    if res: return core_map[res[0]]
    return None

# ── Citation age-normalization ────────────────────────────────────────────────
def build_citation_percentiles(papers):
    """Compute per-year citation percentiles, age-adjusted."""
    current_year = 2025
    by_year = defaultdict(list)
    for p in papers:
        yr   = p.get("year") or 0
        cite = p.get("citations") or 0
        if yr >= 1990:
            # Age-adjust: normalize citations by years since publication
            age   = max(1, current_year - int(yr))
            adj   = cite / math.sqrt(age)   # sqrt dampens but doesn't over-penalize recent papers
            by_year[int(yr)].append((p["paper_id"], adj))

    # For each year, sort and assign percentile rank 0–100
    percentiles = {}
    for yr, items in by_year.items():
        items.sort(key=lambda x: x[1])
        n = len(items)
        for rank, (pid, _) in enumerate(items):
            percentiles[pid] = (rank / max(1, n - 1)) * 100
    return percentiles

# ── SJR / H-index venue quality ───────────────────────────────────────────────
def build_venue_quality(papers):
    """Average SJR score and h_index per venue for imputation."""
    venue_sjr  = defaultdict(list)
    venue_hidx = defaultdict(list)
    for p in papers:
        v = (p.get("venue") or "").lower().strip()
        if not v: continue
        if p.get("sjr_score"): venue_sjr[v].append(float(p["sjr_score"]))
        if p.get("h_index"):   venue_hidx[v].append(float(p["h_index"]))

    avg_sjr  = {v: sum(s)/len(s) for v, s in venue_sjr.items()}
    avg_hidx = {v: sum(h)/len(h) for v, h in venue_hidx.items()}

    # Global stats for normalization
    all_sjr  = list(avg_sjr.values())
    all_hidx = list(avg_hidx.values())
    sjr_p  = np.percentile(all_sjr,  [25,50,75,95]) if all_sjr  else [0,1,2,5]
    hidx_p = np.percentile(all_hidx, [25,50,75,95]) if all_hidx else [0,50,100,200]

    return avg_sjr, avg_hidx, sjr_p, hidx_p

def sjr_score_norm(sjr, sjr_p):
    """Normalize SJR score to 0–100."""
    if not sjr: return None
    if sjr >= sjr_p[3]: return 100
    if sjr >= sjr_p[2]: return 75 + 25 * (sjr - sjr_p[2]) / (sjr_p[3] - sjr_p[2] + 1e-9)
    if sjr >= sjr_p[1]: return 50 + 25 * (sjr - sjr_p[1]) / (sjr_p[2] - sjr_p[1] + 1e-9)
    if sjr >= sjr_p[0]: return 25 + 25 * (sjr - sjr_p[0]) / (sjr_p[1] - sjr_p[0] + 1e-9)
    return 10

def hidx_score_norm(hidx, hidx_p):
    """Normalize H-index to 0–100."""
    if not hidx: return None
    if hidx >= hidx_p[3]: return 100
    if hidx >= hidx_p[2]: return 75 + 25 * (hidx - hidx_p[2]) / (hidx_p[3] - hidx_p[2] + 1e-9)
    if hidx >= hidx_p[1]: return 50 + 25 * (hidx - hidx_p[1]) / (hidx_p[2] - hidx_p[1] + 1e-9)
    if hidx >= hidx_p[0]: return 25 + 25 * (hidx - hidx_p[0]) / (hidx_p[1] - hidx_p[0] + 1e-9)
    return 10

def composite_to_quartile(score):
    """Map composite 0–100 score to approximate quartile."""
    if score >= 72: return "~Q1"
    if score >= 50: return "~Q2"
    if score >= 30: return "~Q3"
    return "~Q4"

def composite_score(cite_pct, core_rank, sjr_norm, hidx_norm):
    """
    Weighted composite quality score (0–100).

    Weights reflect what each signal actually tells us:
    - Citation percentile (age-adjusted): direct measure of paper impact
    - CORE rank: venue prestige, especially for CS conferences
    - SJR score: journal impact factor (journal-level signal)
    - H-index: journal influence breadth

    If a signal is missing, its weight is redistributed to available signals.
    """
    signals = []
    weights = []

    if cite_pct  is not None: signals.append(cite_pct);  weights.append(0.40)
    if core_rank is not None: signals.append(CORE_SCORE[core_rank]); weights.append(0.30)
    if sjr_norm  is not None: signals.append(sjr_norm);  weights.append(0.20)
    if hidx_norm is not None: signals.append(hidx_norm); weights.append(0.10)

    if not signals: return 50.0  # no info → mid-range default
    total_w = sum(weights)
    return sum(s * w for s, w in zip(signals, weights)) / total_w


# ── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Loading papers...")
    papers = []
    with open(ENRICHED, encoding="utf-8") as f:
        for line in f:
            try: papers.append(json.loads(line))
            except: pass
    print(f"Loaded {len(papers):,} papers")

    # Load CORE
    core_map  = load_core()
    core_keys = list(core_map.keys())

    # Build citation percentiles (age-adjusted, per year)
    print("Building age-adjusted citation percentiles...")
    cite_pct = build_citation_percentiles(papers)

    # Build venue quality from SJR/h-index
    print("Building venue quality signals...")
    avg_sjr, avg_hidx, sjr_p, hidx_p = build_venue_quality(papers)

    # Process papers
    already_matched = 0
    core_matched    = 0
    composite_est   = 0
    no_signal       = 0

    out_lines = []
    for p in papers:
        # Skip papers that already have official SCImago quartile
        if p.get("quartile") not in (None, "Unknown", ""):
            already_matched += 1
            out_lines.append(json.dumps(p))
            continue

        venue = (p.get("venue") or "").lower().strip()
        pid   = p.get("paper_id", "")

        # Signal 1: CORE rank
        core_rank = match_core(p.get("venue"), core_map, core_keys) if core_map else None
        if core_rank: core_matched += 1

        # Signal 2: age-adjusted citation percentile
        cp = cite_pct.get(pid)

        # Signal 3: SJR score (paper-level or venue average)
        sjr = p.get("sjr_score") or avg_sjr.get(venue)
        sjr_n = sjr_score_norm(sjr, sjr_p) if sjr else None

        # Signal 4: H-index (paper-level or venue average)
        hidx = p.get("h_index") or avg_hidx.get(venue)
        hidx_n = hidx_score_norm(hidx, hidx_p) if hidx else None

        # Compute composite score
        score = composite_score(cp, core_rank, sjr_n, hidx_n)
        aq    = composite_to_quartile(score)

        p["approx_quartile"]  = aq
        p["composite_score"]  = round(score, 2)
        p["core_rank"]        = core_rank  # store for reference

        if cp is None and core_rank is None and sjr_n is None and hidx_n is None:
            no_signal += 1
        else:
            composite_est += 1

        out_lines.append(json.dumps(p))

    # Write back
    print(f"\nWriting {len(out_lines):,} papers back to {ENRICHED} ...")
    with open(ENRICHED, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines))

    print(f"\n=== Summary ===")
    print(f"  Already SCImago matched:  {already_matched:,}")
    print(f"  CORE venue matched:       {core_matched:,}")
    print(f"  Composite score applied:  {composite_est:,}")
    print(f"  No signals available:     {no_signal:,}")
    print(f"\nNow run: python scripts/rebuild_embeddings.py")
    print("(metadata.parquet will be rebuilt with the updated approx_quartile + composite_score fields)")
