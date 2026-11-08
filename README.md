# Data Center Town

CSC316 group project, Milestone 7 (Prototype V1).
**Team:** Owen Lo, Evan White, Kaiyang Chang, Iftekhar Khaled.

Where data centres are being built fastest in the US, and who ends up owning
the place. Two screens: a present-day briefing, and the same town a hundred
years later with the briefing still nailed to a billboard.

## Quick start

```bash
bash scripts/01_fetch_raw.sh    # download the raw sources (needs network)
make data                       # clean and reshape them
make serve                      # http://localhost:8316
```

`data/processed/` is committed, so `make serve` alone is enough to see it run.

## Layout

| path | what |
|---|---|
| `scripts/` | the data pipeline, four stages, re-runnable |
| `data/raw/` | sources exactly as downloaded, never edited |
| `data/processed/` | the tidy tables the charts load |
| `data/README.md` | sources, every cleaning decision, the output schemas |
| `web/` | the site |
| `web/README.md` | design decisions against the course critique checklist |

## The two built visualisations

**Viz 1 · "Where in the US are data centers being built the fastest?"**
State choropleth of growth in computing-infrastructure establishments against
the national trend, with 1,376 planned and operating sites drawn at their real
coordinates, sized by capacity. The finding: the fastest-growing states are not
the states taking the most power. Georgia is the only one high on both.

**Viz 2 · "Which companies have the most data centers?"**
24,174 facilities resolved from 4,079 raw operator spellings. The finding: on
the raw names Amazon AWS leads; once duplicate spellings merge and acquired
brands roll into their parents, Amazon drops to fourth and three colocation
landlords come out ahead of the cloud brands.
