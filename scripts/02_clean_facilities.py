#!/usr/bin/env python3
"""Stage 1: split and clean the raw directory into two tidy tables.

The raw file is two different datasets stuck together under one key set:

  * 24,258 "directory" records - a global colocation directory. Name, operator,
    city, country, city-level coordinates. No dates, no capacity.
  * 1,499 "pipeline" records   - a US-only list of planned and operating sites
    WITH true lat/lon, capacity in MW, and a build status.

Mixing them would double-count 115 facilities that appear in both. So they come
out as two files, and each visualisation uses the one that fits its question.

Outputs
  data/processed/facilities_global.csv   (directory, cleaned)
  data/processed/us_pipeline.csv         (planned vs operating, with MW)
  data/processed/cleaning_log.json       (every count, for the process book)
"""

import json
import pathlib
import sys
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import pandas as pd
from lib_clean import canonical_company, canonical_state, STATE_NAMES

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

log = {}

records = json.loads((RAW / "datacenters_raw.json").read_text())
log["raw_records"] = len(records)

# ---------------------------------------------------------------------------
# Split
# ---------------------------------------------------------------------------
directory = [r for r in records if not r.get("status")]
pipeline = [r for r in records if r.get("status")]
log["directory_records"] = len(directory)
log["pipeline_records"] = len(pipeline)

# ---------------------------------------------------------------------------
# Table A - global directory
# ---------------------------------------------------------------------------
rows = []
for r in directory:
    company, known = canonical_company(r.get("company"))
    coords = r.get("city_coords") or [None, None]
    rows.append({
        "name": (r.get("name") or "").strip(),
        "company_raw": (r.get("company") or "").strip(),
        "company": company,
        "company_known": known,
        "city": (r.get("city") or "").strip() or None,
        "state": canonical_state(r.get("state")),
        "country": (r.get("country") or "").strip() or None,
        "lat": coords[0],
        "lon": coords[1],
    })
fac = pd.DataFrame(rows)

# Drop rows with no usable identity at all.
before = len(fac)
fac = fac[fac["name"].str.len() > 0]
log["dropped_no_name"] = before - len(fac)

# De-duplicate. The directory lists some facilities twice, usually because the
# same site was scraped under both a campus name and a suite name. Key on
# (name, operator, city) rather than name alone: "Data Center 1" is a real name
# used by many different operators.
before = len(fac)
fac = fac.drop_duplicates(subset=["name", "company_raw", "city"], keep="first")
log["dropped_duplicates"] = before - len(fac)

# `country` is missing on 8,248 directory rows. We keep them - they still count
# toward an operator's global total, which is what Viz 2 asks - but anything
# that slices by geography has to filter on country first. Flagged here so the
# chart can say "n facilities with a known country".
fac["country_known"] = fac["country"].notna()

fac = fac.sort_values(["country", "company", "name"], na_position="last")
fac.to_csv(OUT / "facilities_global.csv", index=False)
log["facilities_global_rows"] = len(fac)
log["facilities_with_country"] = int(fac["country_known"].sum())
log["facilities_with_operator"] = int(fac["company_known"].sum())
log["distinct_operators_raw"] = fac["company_raw"].nunique()
log["distinct_operators_clean"] = fac["company"].nunique()

# ---------------------------------------------------------------------------
# Table B - US build pipeline
# ---------------------------------------------------------------------------
rows = []
for r in pipeline:
    company, known = canonical_company(r.get("company"))
    rows.append({
        "name": (r.get("name") or "").strip(),
        "company": company,
        "state": canonical_state(r.get("state")),
        "status": r.get("status"),
        "capacity_mw": r.get("capacity_mw"),
        "lat": r.get("latitude"),
        "lon": r.get("longitude"),
    })
pipe = pd.DataFrame(rows)

before = len(pipe)
pipe = pipe[pipe["status"] != "Canceled"]      # 9 rows, not part of the pipeline
log["dropped_cancelled"] = before - len(pipe)

before = len(pipe)
pipe = pipe.dropna(subset=["lat", "lon", "state"])
log["dropped_pipeline_no_location"] = before - len(pipe)

before = len(pipe)
pipe = pipe.drop_duplicates(subset=["name", "state"], keep="first")
log["dropped_pipeline_duplicates"] = before - len(pipe)

# Keep the continental bounding box honest - a handful of rows carry a
# truncated longitude (e.g. -83 exactly) but they still land in the right state.
pipe = pipe[(pipe["lat"].between(17, 72)) & (pipe["lon"].between(-180, -64))]

pipe["state_name"] = pipe["state"].map(STATE_NAMES)
pipe["capacity_known"] = pipe["capacity_mw"].notna()
pipe = pipe.sort_values(["status", "capacity_mw"], ascending=[True, False])
pipe.to_csv(OUT / "us_pipeline.csv", index=False)

log["us_pipeline_rows"] = len(pipe)
log["us_pipeline_by_status"] = dict(Counter(pipe["status"]))
log["us_pipeline_with_capacity"] = int(pipe["capacity_known"].sum())
log["us_pipeline_total_planned_mw"] = float(
    pipe.loc[pipe["status"] == "Planned", "capacity_mw"].sum())

(OUT / "cleaning_log.json").write_text(json.dumps(log, indent=2))
for k, v in log.items():
    print(f"{k:34s} {v}")
