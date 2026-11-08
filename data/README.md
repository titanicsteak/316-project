# Data pipeline

Everything in `data/processed/` is generated. Nothing is edited by hand.

```bash
bash scripts/01_fetch_raw.sh       # download raw sources into data/raw/
python3 scripts/02_clean_facilities.py
python3 scripts/03_companies.py    # -> Viz 2
python3 scripts/04_us_growth.py    # -> Viz 1
```

or `make data` from the repo root.

---

## Sources

| # | Source | What it gives us | Licence / access |
|---|---|---|---|
| 1 | [ringmast4r/Global-Data-Center-Map](https://github.com/ringmast4r/Global-Data-Center-Map) — scraped from [datacentermap.com](https://www.datacentermap.com/datacenters/) | 25,757 facility records: name, operator, city, country, coordinates. A US subset also carries build status and capacity in MW. | Public GitHub repo, commit pinned in `data/raw/gdcm_commit.txt` |
| 2 | [BLS QCEW](https://data.bls.gov/cew/apps/data_views/data_views.htm), NAICS 518 | Establishment and employment counts per US state, Q1 2021–2025. The only public per-state series with a real time dimension. | US public domain |
| 3 | [Our World in Data / IEA](https://ourworldindata.org/grapher/data-centers-share-electricity-demand) | Data centre share of electricity demand by region, 2020–2025. Narrative context. | CC BY |
| 4 | [us-atlas](https://github.com/topojson/us-atlas) `states-10m` | US state boundaries for the choropleth. | ISC |

---

## The two decisions that shaped the cleaning

### 1. The raw file is two datasets, not one

The 25,757 records split cleanly:

- **24,258 directory records** — a global colocation directory. Operator, city,
  country, city-level coordinates. No dates, no capacity.
- **1,499 pipeline records** — US only, but with *true* lat/lon, capacity in MW,
  and a build status (Planned / Operating / Canceled).

115 facilities appear in both. Merging them would double-count, so they stay in
separate files and each chart uses the one that fits its question.

### 2. "Fastest" needs a rate, and NAICS 518 changed definition in 2022

A map of where data centres *are* answers "where", not "fastest". The growth
rate comes from QCEW establishment counts instead.

The catch: NAICS 518 was **redefined in the 2022 NAICS revision** — renamed to
"Computing Infrastructure Providers, Data Processing, Web Hosting and Related
Services" and expanded to absorb part of 519130. The national establishment
count jumps **34,103 → 43,389 (+27%) in that single year**, which is mostly
reclassification rather than construction.

So the growth window is **Q1 2022 → Q1 2025**, both on the current definition.
2021 is kept in the output as its own column, never inside a growth figure.

Two further guards in `us_state_growth.csv`:

- `growth_vs_national` — each state's growth minus the national 26.7%, so the
  chart can say "faster than the country as a whole" rather than implying the
  raw percentage is a count of new data centres.
- `small_base` — true when a state had under 150 establishments in 2022. Those
  states swing wildly on a handful of openings. Flagged, not dropped, so the
  chart can grey them out instead of letting them top the ranking.

**Stated on the chart:** NAICS 518 is broader than data centres. It includes web
hosting and data processing firms. It is a proxy for the sector's footprint, not
a data centre census.

---

## Outputs

### `facilities_global.csv` — 24,174 rows
Cleaned global directory. One row per facility.

| column | type | notes |
|---|---|---|
| `name` | text | facility name |
| `company_raw` | text | operator exactly as the source spells it |
| `company` | text | canonical operator (see below); blank when unknown |
| `company_known` | bool | false for 99 rows with no usable operator |
| `city`, `state`, `country` | text | `state` is a USPS code, US only |
| `lat`, `lon` | float | **city centroid, not the building.** Every facility in a city shares one point. Fine for country totals, not for a site map. |
| `country_known` | bool | false for 8,243 rows — they still count toward an operator's global total, but anything sliced by geography must filter on this first |

84 duplicate rows were dropped, keyed on (name, operator, city). Name alone is
not unique: "Data Center 1" belongs to several different operators.

### `us_pipeline.csv` / `us_pipeline_sites.csv` — 1,376 rows
US build pipeline. 784 Planned, 592 Operating. 9 Canceled, 104 without a
location and 10 duplicates were dropped. 778 rows carry `capacity_mw`
(`capacity_known` flags the rest). **235,357 MW planned** against 16,364 MW
operating.

`lat`/`lon` here are real site coordinates, unlike the directory file.

### `us_state_growth.csv` — 52 rows
Choropleth input. One row per state plus DC and Puerto Rico. Joins QCEW growth,
pipeline counts and MW, and existing directory stock. See the two guards above.

### `companies.csv` / `companies_top25.csv` — 3,999 operators
Viz 2 input. `facilities`, `countries`, `us_facilities`, `share_of_directory_pct`.

### `companies_merge_audit.csv`
**The evidence for the cleaning.** One row per (canonical name, raw spelling)
for every operator in the top 25 whose name was combined. Two kinds of merge:

- *Brand aliases* — the same company filed under several labels.
  `Amazon AWS` (539) + `Amazon` (64); `Microsoft` (192) + `Microsoft Azure` (92);
  `CyrusOne` (137) + `CyrusOne Data Centers` (88); `Meta` + `Meta, Inc.` +
  `Facebook`; `Cogent Communications` under three punctuations.
- *Acquisitions* — the acquired brand still appears under its old name.
  `CenturyLink` → `Lumen` (rebranded 2020), `Interxion` → `Digital Realty`
  (acquired 2020), `Infomart` → `Equinix`.

Every rule is listed explicitly in `scripts/lib_clean.py`. No fuzzy matching.

**This changes the answer.** On the raw names Amazon AWS leads with 539. After
cleaning the top four are Digital Realty (759), Equinix (711), Lumen (674),
Amazon AWS (603) — Amazon drops from first to fourth, and three colocation
landlords nobody has heard of come out ahead of the cloud brands. The chart has
to say which version it is showing.

### `cleaning_log.json`, `us_growth_meta.json`, `us_national_518.csv`
Every count above, written out at run time so the process book quotes the
pipeline rather than a screenshot.
