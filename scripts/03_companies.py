#!/usr/bin/env python3
"""Viz 2 - "Which companies have the most data centers?"

Input : data/processed/facilities_global.csv
Output: data/processed/companies.csv            (every operator, ranked)
        data/processed/companies_top25.csv      (what the chart loads)
        data/processed/companies_merge_audit.csv (what got combined into what)

The whole point of this step is the merge audit. The raw directory lists
"Amazon AWS" (539), "Amazon" (65) and "AWS" separately, and "CenturyLink" (236)
separately from "Lumen" (444), which is the same company since 2020. The sketch
for this chart used the uncleaned numbers, so Amazon showed 533 and Lumen 403.
Cleaning changes the ranking, and the audit file is the evidence for that.
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import pandas as pd
from lib_clean import ACQUISITIONS

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "processed"

fac = pd.read_csv(OUT / "facilities_global.csv")
fac = fac[fac["company_known"]]

companies = (
    fac.groupby("company")
       .agg(facilities=("name", "size"),
            countries=("country", lambda s: s.dropna().nunique()),
            us_facilities=("country", lambda s: (s == "United States").sum()))
       .reset_index()
       .sort_values("facilities", ascending=False)
)
companies["share_of_directory_pct"] = (
    100 * companies["facilities"] / len(fac)).round(2)
companies["rank"] = range(1, len(companies) + 1)
companies.to_csv(OUT / "companies.csv", index=False)

top = companies.head(25).copy()
top.to_csv(OUT / "companies_top25.csv", index=False)

# --- merge audit -------------------------------------------------------------
# For each canonical operator, which raw spellings fed into it, and how many
# facilities each spelling contributed.
audit = (
    fac.groupby(["company", "company_raw"])
       .size().reset_index(name="facilities")
       .sort_values(["company", "facilities"], ascending=[True, False])
)
# Only the operators where cleaning actually changed something.
multi = audit.groupby("company")["company_raw"].nunique()
audit = audit[audit["company"].isin(multi[multi > 1].index)]
audit = audit[audit["company"].isin(top["company"])]
audit.to_csv(OUT / "companies_merge_audit.csv", index=False)

print(f"operators after cleaning : {len(companies)}")
print(f"facilities with operator : {len(fac)}")
print(f"\ntop 12 (acquisitions rolled up: {sorted(set(ACQUISITIONS) - set(ACQUISITIONS.values()))})\n")
print(top.head(12)[["rank", "company", "facilities", "countries",
                    "us_facilities"]].to_string(index=False))
print("\nmerges behind the top 25:\n")
print(audit.to_string(index=False))
