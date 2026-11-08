#!/usr/bin/env bash
# Download every raw source into data/raw/. Re-runnable; nothing here is edited
# by hand. Run from the repo root:  bash scripts/01_fetch_raw.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# --- 1. Global data centre directory -----------------------------------------
# ringmast4r/Global-Data-Center-Map, scraped from datacentermap.com and merged
# with a US power-pipeline list. 25,757 records.
echo "[1/4] global data centre directory"
git clone --depth 1 -q https://github.com/ringmast4r/Global-Data-Center-Map "$TMP/gdcm"
cp "$TMP/gdcm/datacenters_raw.json" data/raw/datacenters_raw.json
cp "$TMP/gdcm/STATISTICS.md"        data/raw/gdcm_STATISTICS.md
( cd "$TMP/gdcm" && git rev-parse HEAD ) > data/raw/gdcm_commit.txt

# --- 2. BLS QCEW, NAICS 518 ---------------------------------------------------
# "Computing infrastructure providers, data processing, web hosting and related
# services", Q1 of each year, every county and state. This is the only public
# per-state series with a real time dimension, so it carries "fastest".
# 2021 is on the NAICS 2017 definition and 2022+ on NAICS 2022, so the growth
# window starts at 2022 (see scripts/04_us_growth.py). 2021 is kept for the
# record, not for the comparison.
echo "[2/4] BLS QCEW NAICS 518"
for YEAR in 2021 2022 2023 2024 2025; do
  curl -sfL -A 'Mozilla/5.0 (CSC316 coursework)' \
    "https://data.bls.gov/cew/data/api/${YEAR}/1/industry/518.csv" \
    -o "data/raw/qcew_518_${YEAR}q1.csv"
done

# --- 3. IEA data centre share of electricity demand (via Our World in Data) ---
echo "[3/4] OWID / IEA electricity share"
curl -sfL "https://ourworldindata.org/grapher/data-centers-share-electricity-demand.csv?csvType=full&useColumnShortNames=true" \
  -o data/raw/owid_dc_share_electricity.csv

# --- 4. US states TopoJSON ----------------------------------------------------
echo "[4/4] US states topology"
curl -sfL "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json" \
  -o data/raw/us-states-10m.json

echo "done. raw files:"
ls -la data/raw
