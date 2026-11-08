"""Shared cleaning helpers for the CSC316 data-centre project.

Two jobs live here:
  * `canonical_company` - collapse the 4,079 raw operator spellings into one
    name per real operator (Viz 2: "Which companies have the most data centers?")
  * `canonical_state` / `STATE_FIPS` - turn the mix of "VA" and "California"
    into one USPS code per state (Viz 1: the US map)

Every merge rule is listed explicitly rather than guessed by fuzzy matching, so
the process book can show exactly what was combined and why.
"""

import re
import unicodedata

# ---------------------------------------------------------------------------
# Company names
# ---------------------------------------------------------------------------

# Suffixes that carry no information about who the operator is. Stripped before
# matching so "Cogent Communications, Inc." and "Cogent Communications Inc."
# land on the same key.
_LEGAL_SUFFIXES = [
    "incorporated", "inc", "llc", "l l c", "ltd", "limited", "plc", "corp",
    "corporation", "co", "company", "gmbh", "ag", "sa", "s a", "nv", "n v",
    "bv", "b v", "srl", "spa", "s p a", "pty", "pte", "lp", "llp", "group",
    "holdings", "holding", "international", "worldwide", "global",
]

# Generic words that operators bolt onto their own brand. Removing them merges
# "CyrusOne" with "CyrusOne Data Centers" without touching the brand itself.
_GENERIC_TAIL = [
    "data centers", "data center", "datacenters", "datacenter",
    "data centres", "data centre", "datacentres", "datacentre",
    "colocation", "colo", "hosting", "telecom", "telecoms",
    "communications", "networks", "network", "infrastructure",
    "technologies", "technology", "solutions", "services", "systems",
]

# Explicit brand merges: normalised key -> canonical display name.
# Only the clear-cut cases. Each line is a company publishing facilities under
# more than one label in the source directory.
_BRAND_ALIASES = {
    "amazon aws": "Amazon AWS",
    "amazon": "Amazon AWS",
    "aws": "Amazon AWS",
    "amazon web": "Amazon AWS",
    "microsoft": "Microsoft",
    "microsoft azure": "Microsoft",
    "azure": "Microsoft",
    "google": "Google",
    "google cloud": "Google",
    "google cloud platform": "Google",
    "meta": "Meta",
    "facebook": "Meta",
    "digital realty": "Digital Realty",
    "digital realty trust": "Digital Realty",
    "cyrusone": "CyrusOne",
    "stack": "STACK Infrastructure",
    "ntt": "NTT",
    "ntt gdc": "NTT",
    "cogent": "Cogent Communications",
    "edgeconnex": "EdgeConneX",
    "edge connex": "EdgeConneX",
    "china telecom": "China Telecom",
    "china unicom": "China Unicom",
    "china mobile": "China Mobile",
    "iron mountain": "Iron Mountain",
    "zenlayer": "Zenlayer",
    "equinix": "Equinix",
    "lumen": "Lumen",
    "databank": "DataBank",
    "tierpoint": "TierPoint",
    "flexential": "Flexential",
    "cologix": "Cologix",
    "coresite": "CoreSite",
    "telehouse": "Telehouse",
    "365": "365 Data Centers",
    "vantage": "Vantage Data Centers",
    "qts": "QTS",
    "sungard": "Sungard",
    "sungard availability": "Sungard",
    "centersquare": "Centersquare",
    "cyxtera": "Centersquare",
    "evoque": "Centersquare",
}

# Acquisitions: the acquired brand still appears in the directory under its old
# name. Rolling these up answers "which companies operate the most data centres
# TODAY"; leaving them split answers "which brands appear in the directory".
# We roll up, and `ACQUISITIONS` is written out alongside the data so the chart
# can say so.
ACQUISITIONS = {
    "CenturyLink": "Lumen",      # CenturyLink rebranded to Lumen in 2020
    "Level 3": "Lumen",          # Level 3 acquired by CenturyLink, 2017
    "Interxion": "Digital Realty",  # acquired 2020
    "Telecity": "Equinix",       # acquired 2016
    "Infomart": "Equinix",       # acquired 2018
    "Packet": "Equinix",         # acquired 2020
    "Switch": "Switch",          # kept separate (DigitalBridge, still branded)
    "Zayo": "Zayo",
}

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^a-z0-9 ]+")


def _normalise(raw):
    """Lowercase, strip accents, punctuation, legal suffixes and generic tails."""
    s = unicodedata.normalize("NFKD", str(raw))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = _PUNCT.sub(" ", s)
    s = _WS.sub(" ", s).strip()

    # Drop generic descriptive tails ("... Data Centers", "... Networks").
    changed = True
    while changed:
        changed = False
        for tail in _GENERIC_TAIL:
            if s.endswith(" " + tail):
                s = s[: -len(tail) - 1].strip()
                changed = True
    # Drop legal suffixes, repeatedly ("Foo Group Holdings Ltd").
    changed = True
    while changed:
        changed = False
        for suf in _LEGAL_SUFFIXES:
            if s.endswith(" " + suf):
                s = s[: -len(suf) - 1].strip()
                changed = True
    return s


# Placeholder values the directory uses when the operator is not recorded.
_UNKNOWN = {"", "unknown", "unknown company", "n a", "na", "none", "private",
            "undisclosed", "confidential", "various"}


def canonical_company(raw, roll_up_acquisitions=True):
    """Return (canonical_name, is_known). `None` name means operator unknown."""
    if raw is None:
        return None, False
    key = _normalise(raw)
    if key in _UNKNOWN:
        return None, False

    name = _BRAND_ALIASES.get(key)
    if name is None:
        # Title-case the normalised key but keep the original casing when the
        # source already looks like a proper name (avoids "Ovh" / "Ntt").
        name = str(raw).strip()
        name = _WS.sub(" ", name)
        # Trim the same legal suffixes off the display name.
        for suf in (", Inc.", " Inc.", ", LLC", " LLC", ", Ltd.", " Ltd.",
                    ", Inc", " Inc", " Corp.", " Corp"):
            if name.endswith(suf):
                name = name[: -len(suf)].strip()

    if roll_up_acquisitions:
        name = ACQUISITIONS.get(name, name)
    return name, True


# ---------------------------------------------------------------------------
# US states
# ---------------------------------------------------------------------------

STATE_FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08",
    "CT": "09", "DE": "10", "DC": "11", "FL": "12", "GA": "13", "HI": "15",
    "ID": "16", "IL": "17", "IN": "18", "IA": "19", "KS": "20", "KY": "21",
    "LA": "22", "ME": "23", "MD": "24", "MA": "25", "MI": "26", "MN": "27",
    "MS": "28", "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33",
    "NJ": "34", "NM": "35", "NY": "36", "NC": "37", "ND": "38", "OH": "39",
    "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45", "SD": "46",
    "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51", "WA": "53",
    "WV": "54", "WI": "55", "WY": "56", "PR": "72",
}

STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut",
    "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida",
    "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois",
    "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky",
    "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota",
    "MS": "Mississippi", "MO": "Missouri", "MT": "Montana",
    "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire",
    "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania",
    "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota",
    "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "PR": "Puerto Rico",
}

_NAME_TO_CODE = {v.lower(): k for k, v in STATE_NAMES.items()}
_NAME_TO_CODE["washington dc"] = "DC"
_NAME_TO_CODE["washington d c"] = "DC"


def canonical_state(raw):
    """Accept 'VA', 'Virginia', 'virginia ' -> 'VA'. Unknown -> None."""
    if raw is None:
        return None
    s = _WS.sub(" ", _PUNCT.sub(" ", str(raw).lower())).strip()
    if not s:
        return None
    up = s.upper().replace(" ", "")
    if up in STATE_FIPS:
        return up
    return _NAME_TO_CODE.get(s)
