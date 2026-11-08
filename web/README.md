# Data Center Town

Two screens. The present is a briefing; the future is a walkable ruin with the
briefing still nailed to a billboard.

```
screen 1   D3    "Where in the US are data centers being built the fastest?"
   |              choropleth of growth + site dots sized by megawatts
   |       [ Let's go 100 years into the future ]
   v
screen 2   three.js   a company town, a hundred years on
                      click the billboard ->
           D3    "Which companies have the most data centers?"
```

## Running it

```bash
make serve          # or: cd web && python3 -m http.server 8316
```

then open <http://localhost:8316>. A server is required: the charts `fetch`
their CSVs, which `file://` blocks.

No build step and no network at run time. `d3`, `topojson-client` and `three`
are vendored into `vendor/`, and `data/` holds the output of the pipeline in
`../scripts/`.

## Why three.js for the world and D3 for the charts

The wasteland is scenery. Nothing in it encodes data except the billboard, and
the billboard opens a real SVG chart rather than trying to be one in 3D. A bar
chart painted onto a plane in perspective breaks every length comparison it
depends on, which is the whole reason it is a bar chart.

## Files

| file | what it does |
|---|---|
| `js/main.js` | screen machine, the hundred-year transition, billboard overlay |
| `js/store.js` | the one selection state every view derives from |
| `js/palette.js` | colour tokens and a WCAG contrast self-check, logged on boot |
| `js/viz/map.js` | Viz 1 |
| `js/viz/companies.js` | Viz 2 |
| `js/world/wasteland.js` | the three.js scene |

## Against the design critique checklist

**§1 Truthful and readable.** Both titles state the finding, not the topic.
Every counting choice is in the figure caption: the NAICS 518 redefinition and
why the window starts at 2022, that NAICS 518 is broader than data centres,
how many sites have no recorded capacity and what happens to them at the
current filter, and that a "facility" is a directory entry rather than a
building or a megawatt.

**§2 Components and reactivity.** One `store.js`, one selection object. Views
subscribe; nothing pushes into another view directly.

**§3 Encoding and channels.** Every channel names a column (listed at the top of
each viz file). Area is `scaleSqrt` anchored at zero, with a nested-circle size
legend so area is actually decodable. Bars have a zero baseline.

**§4 Interaction and coordination.** All seven Yi et al. intents are reachable:
*select* (hover or click a state), *explore* and *abstract/elaborate* (walking
the world, the detail panel), *reconfigure* (bars ↔ bubbles), *encode* (growth
↔ megawatts), *filter* (the megawatt floor, the small-base toggle),
*connect* (map and ranked list are the same selection). Hovering a state
highlights; the megawatt slider removes and the caption recounts, so a filter
never pretends to be the whole set. "Clear selection" is the way back.

**§5 Story and annotation.** One idea per screen. The present screen has one
finding (growth and scale come apart), the billboard has one (cleaning the
names changes who wins). Placeholder cards carry the three designed-not-built
views so the narrative arc is visible.

**§6 Perception and critique.** Checked in headless Chrome under deuteranopia,
protanopia and achromatopsia. Status is carried by hue *and* shape (ring vs
square), so it survives greyscale. The small-base flag is a hatch, not a
colour. The ranked list repeats the choropleth's values on length and position,
so the map is never the only way to read the ranking. Contrast pairs are
asserted at boot and printed to the console.

Two failures this pass caught, both of which the code had rated as fine:

- 1,376 site dots at full strength buried the choropleth. The megawatt floor now
  opens at 100 MW, and the slider walks down to the long tail.
- The megawatt ramp was orange-brown, the same hue family as the orange site
  rings, so the heaviest states swallowed their own dots. It is purple now.

**§7 Colour and colormaps.** Growth against the national average is signed with
a meaningful zero, so it gets a **diverging** ramp (RdBu reversed) anchored
exactly on zero with a symmetric domain, and the legend marks and names that
zero. Planned megawatts is unsigned and right-skewed, so it gets a
**sequential** ramp with the skew handled by a square-rooted domain rather than
by bending the palette. Build status is nominal with two levels, so two Okabe-Ito
hues. No rainbow anywhere. Legend ends are labelled in words as well as numbers.

### What the checklist cannot tell us

Whether a reader who has never seen the map gets "growth and scale come apart"
out of it. That needs a think-aloud, which is Lab 8.
