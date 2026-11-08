#!/usr/bin/env python3
"""Viz 1 - "Where in the US are data centers being built the fastest?"

"Fastest" is a rate, so a map of where data centres *are* cannot answer it. Two
sources are joined here, each covering what the other misses:

  * BLS QCEW, NAICS 518 (computing infrastructure, data processing, web
    hosting), Q1 of 2022 through 2025. Establishment counts per state. This
    carries "fastest".
  * The US build pipeline from stage 1: planned vs operating sites with
    capacity in MW. This carries "how much is coming, and where exactly".

Two things had to be handled rather than assumed:

  1. NAICS 518 was redefined in the 2022 NAICS revision - it absorbed part of
     519130 and was renamed to "Computing Infrastructure Providers...". Q1 2021
     is on the old definition, so 2021 -> 2025 mixes real growth with a
     reclassification: the national establishment count jumps 27% in that one
     year alone. The growth window therefore starts at **Q1 2022**, the first
     year on the current definition. 2021 is carried in the output as a
     separate column with a flag, never inside the growth figure.

  2. NAICS 518 is broader than data centres - it includes web hosting and data
     processing firms. It is a proxy for the sector's footprint, not a census.
     `growth_vs_national` reports each state against the national trend, so the
     chart can say "faster than the country as a whole" rather than implying
     the raw percentage is a data centre count.

Outputs
  data/processed/us_state_growth.csv   (one row per state - choropleth input)
  data/processed/us_pipeline_sites.csv (one row per site - dot overlay input)
  data/processed/us_national_518.csv   (national totals, for the caption)
"""

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import pandas as pd
from lib_clean import STATE_FIPS, STATE_NAMES

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

BASE_YEAR, END_YEAR = 2022, 2025       # both on the NAICS 2022 definition
ALL_YEARS = [2021, 2022, 2023, 2024, 2025]

FIPS_TO_CODE = {v: k for k, v in STATE_FIPS.items()}


def read_qcew(year):
    """State-level private-sector NAICS 518, one row per state."""
    d = pd.read_csv(RAW / f"qcew_518_{year}q1.csv", dtype=str)
    # agglvl 55 = state x industry; own_code 5 = private sector.
    d = d[(d["agglvl_code"] == "55") & (d["own_code"] == "5")].copy()
    d["state"] = d["area_fips"].str[:2].map(FIPS_TO_CODE)
    d = d.dropna(subset=["state"])
    d["estabs"] = pd.to_numeric(d["qtrly_estabs"], errors="coerce")
    d["emp"] = pd.to_numeric(d["month3_emplvl"], errors="coerce")
    # 'N' means BLS suppressed the value for confidentiality - not a zero.
    d.loc[d["disclosure_code"] == "N", "emp"] = pd.NA
    d.loc[d["emp"] == 0, "emp"] = pd.NA
    return d.set_index("state")[["estabs", "emp"]].add_suffix(f"_{year}")


def national(year):
    d = pd.read_csv(RAW / f"qcew_518_{year}q1.csv", dtype=str)
    d = d[(d["agglvl_code"] == "15") & (d["own_code"] == "5")]
    return (int(d["qtrly_estabs"].iloc[0]), int(d["month3_emplvl"].iloc[0]))


# --- national context ---------------------------------------------------------
nat = pd.DataFrame(
    [{"year": y, "estabs": national(y)[0], "emp": national(y)[1],
      "naics_vintage": "2017" if y < 2022 else "2022"} for y in ALL_YEARS])
nat.to_csv(OUT / "us_national_518.csv", index=False)

nat_base = int(nat.loc[nat.year == BASE_YEAR, "estabs"].iloc[0])
nat_end = int(nat.loc[nat.year == END_YEAR, "estabs"].iloc[0])
NAT_GROWTH = 100 * (nat_end - nat_base) / nat_base

# --- per state ----------------------------------------------------------------
q = read_qcew(ALL_YEARS[0])
for y in ALL_YEARS[1:]:
    q = q.join(read_qcew(y), how="outer")
q = q.reset_index().rename(columns={"index": "state"})

b, e = f"estabs_{BASE_YEAR}", f"estabs_{END_YEAR}"
q["estab_growth_pct"] = (100 * (q[e] - q[b]) / q[b]).round(1)
q["estab_change"] = q[e] - q[b]
q["growth_vs_national"] = (q["estab_growth_pct"] - NAT_GROWTH).round(1)
q["emp_growth_pct"] = (
    100 * (q[f"emp_{END_YEAR}"] - q[f"emp_{BASE_YEAR}"])
    / q[f"emp_{BASE_YEAR}"]).round(1)

# Small states swing wildly on a handful of establishments. Flag rather than
# drop, so the chart can grey them out instead of letting them top the ranking.
q["small_base"] = q[b] < 150

# --- join the build pipeline --------------------------------------------------
pipe = pd.read_csv(OUT / "us_pipeline.csv")

by_state = pipe.pivot_table(index="state", columns="status", values="name",
                            aggfunc="size", fill_value=0)
by_state.columns = [f"sites_{c.lower()}" for c in by_state.columns]

mw = pipe.pivot_table(index="state", columns="status", values="capacity_mw",
                      aggfunc="sum", fill_value=0)
mw.columns = [f"mw_{c.lower()}" for c in mw.columns]

# Existing stock from the global directory, for context on the growth rate.
fac = pd.read_csv(OUT / "facilities_global.csv")
stock = (fac[fac["country"] == "United States"]
         .groupby("state").size().rename("directory_facilities"))

df = (q.set_index("state")
        .join(by_state, how="left")
        .join(mw, how="left")
        .join(stock, how="left")
        .reset_index())

for c in ["sites_planned", "sites_operating", "mw_planned", "mw_operating",
          "directory_facilities"]:
    if c not in df:
        df[c] = 0
    df[c] = df[c].fillna(0)

df["state_name"] = df["state"].map(STATE_NAMES)
df["fips"] = df["state"].map(STATE_FIPS)
df = df.dropna(subset=["fips"])

cols = (["state", "state_name", "fips"]
        + [f"estabs_{y}" for y in ALL_YEARS]
        + ["estab_change", "estab_growth_pct", "growth_vs_national",
           "small_base", f"emp_{BASE_YEAR}", f"emp_{END_YEAR}",
           "emp_growth_pct", "sites_planned", "sites_operating",
           "mw_planned", "mw_operating", "directory_facilities"])
df = df[cols].sort_values("estab_growth_pct", ascending=False)
df.to_csv(OUT / "us_state_growth.csv", index=False)

# --- site-level file for the dot overlay -------------------------------------
sites = pipe[["name", "company", "state", "state_name", "status",
              "capacity_mw", "lat", "lon"]].copy()
sites = sites.sort_values("capacity_mw", ascending=False)
sites.to_csv(OUT / "us_pipeline_sites.csv", index=False)

meta = {
    "growth_window": f"Q1 {BASE_YEAR} to Q1 {END_YEAR}",
    "naics_note": "NAICS 518 redefined in the 2022 revision; window starts 2022",
    "national_estab_growth_pct": round(NAT_GROWTH, 1),
    "national_estabs": {str(y): int(nat.loc[nat.year == y, 'estabs'].iloc[0])
                        for y in ALL_YEARS},
    "states": len(df),
    "pipeline_sites": len(sites),
    "total_planned_mw": float(pipe.loc[pipe.status == "Planned",
                                       "capacity_mw"].sum()),
    "total_operating_mw": float(pipe.loc[pipe.status == "Operating",
                                         "capacity_mw"].sum()),
}
(OUT / "us_growth_meta.json").write_text(json.dumps(meta, indent=2))

print(json.dumps(meta, indent=2))
big = df[~df["small_base"]]
print(f"\nfastest growing, excluding states under 150 establishments in {BASE_YEAR}\n")
print(big.head(12)[["state_name", b, e, "estab_growth_pct",
                    "growth_vs_national", "sites_planned",
                    "mw_planned"]].to_string(index=False))
print("\nmost planned capacity\n")
print(df.sort_values("mw_planned", ascending=False)
        .head(10)[["state_name", "mw_planned", "sites_planned",
                   "estab_growth_pct"]].to_string(index=False))
