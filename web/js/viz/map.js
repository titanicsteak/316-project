/**
 * Viz 1 - "Where in the US are data centers being built the fastest?"
 *
 * Two layers on one canvas, because the answer splits in two and the split is
 * the finding:
 *
 *   choropleth  state growth in NAICS 518 establishments, Q1 2022 -> Q1 2025,
 *               measured against the national trend. Carries "fastest".
 *   dots        individual planned and operating sites, area = capacity in MW,
 *               at their real coordinates. Carries "how much, and where".
 *
 * The states growing fastest are not the states taking the most capacity.
 * Georgia is the only state high on both.
 *
 * Channels (§3) - every one names a column:
 *   state fill      growth_vs_national   diverging, anchored at 0
 *   state hatch     small_base           texture, not a colour
 *   dot x,y         lon, lat             albersUsa projection
 *   dot area        capacity_mw          scaleSqrt, zero-anchored
 *   dot hue+shape   status               two hues AND two shapes (§6)
 *   bar length      whichever measure is selected, zero baseline
 */

import { PALETTE } from '../palette.js';
import * as store from '../store.js';

const M = { t: 16, r: 16, b: 16, l: 16 };

export async function renderMap(root) {
  const [us, states, sites, meta] = await Promise.all([
    d3.json('data/us-states-10m.json'),
    d3.csv('data/us_state_growth.csv', d3.autoType),
    d3.csv('data/us_pipeline_sites.csv', d3.autoType),
    d3.json('data/us_growth_meta.json'),
  ]);

  // pandas writes booleans as "True"/"False"; d3.autoType only recognises the
  // lowercase pair, so without this every state reads as truthy and the
  // small-base filter silently matches nothing.
  states.forEach((d) => { d.small_base = String(d.small_base).toLowerCase() === 'true'; });

  const byFips = new Map(states.map((d) => [String(d.fips).padStart(2, '0'), d]));
  const byCode = new Map(states.map((d) => [d.state, d]));
  const geo = topojson.feature(us, us.objects.states);
  const mesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);

  root.innerHTML = `
    <header class="viz-head">
      <h2 id="map-title"></h2>
      <p class="sub" id="map-sub"></p>
    </header>
    <div class="map-grid">
      <figure class="map-figure">
        <svg id="map-svg" role="img" aria-labelledby="map-title"></svg>
        <figcaption id="map-caption"></figcaption>
      </figure>
      <aside class="map-side">
        <div class="controls" id="map-controls"></div>
        <div class="detail" id="map-detail"></div>
        <div class="ranked" id="map-ranked"></div>
      </aside>
    </div>`;

  buildControls(root.querySelector('#map-controls'), meta);

  const svg = d3.select(root).select('#map-svg');
  const W = 820; const H = 500;
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');

  const projection = d3.geoAlbersUsa().fitExtent(
    [[M.l, M.t], [W - M.r, H - M.b - 86]], geo);
  const path = d3.geoPath(projection);

  // --- defs: the hatch that carries small_base without spending a hue ------
  const defs = svg.append('defs');
  defs.append('pattern')
    .attr('id', 'hatch-smallbase')
    .attr('width', 6).attr('height', 6)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('patternTransform', 'rotate(45)')
    .append('line')
    .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6)
    .attr('stroke', PALETTE.present.inkDim)
    .attr('stroke-width', 2.5);

  // --- scales ---------------------------------------------------------------
  // Diverging, symmetric about zero. Zero is the national trend, which is the
  // only value on this axis that means anything on its own (§7).
  const gExtent = d3.max(states, (d) => Math.abs(d.growth_vs_national ?? 0));
  const growthColor = d3.scaleDiverging(PALETTE.diverging)
    .domain([-gExtent, 0, gExtent]);

  // Planned MW is unsigned and right-skewed. Sequential, square-rooted in the
  // DOMAIN so the ramp itself stays perceptually even (§7).
  //
  // Purple rather than the obvious orange-brown: the site rings are already
  // Okabe-Ito orange, and on an orange ramp the biggest states swallowed their
  // own dots. Purple also stays clear of the operating squares' blue under
  // both deuteranopia and protanopia.
  const mwColor = d3.scaleSequentialSqrt(d3.interpolatePurples)
    .domain([0, d3.max(states, (d) => d.mw_planned)]);

  // Area proportional to MW: sqrt scale, both ends anchored at zero (§3).
  const radius = d3.scaleSqrt()
    .domain([0, d3.max(sites, (d) => d.capacity_mw || 0)])
    .range([0, 22]);

  const gStates = svg.append('g');
  const gMesh = svg.append('g');
  const gDots = svg.append('g').attr('class', 'dots');
  const gLegend = svg.append('g').attr('transform', `translate(${M.l},${H - 42})`);

  const statePaths = gStates.selectAll('path')
    .data(geo.features)
    .join('path')
    .attr('d', path)
    .attr('class', 'state')
    .attr('tabindex', 0)
    .attr('role', 'button')
    .on('pointerenter', (e, f) => store.set({ hoveredState: codeOf(f) }))
    .on('pointerleave', () => store.set({ hoveredState: null }))
    .on('click', (e, f) => toggleState(codeOf(f)))
    .on('keydown', (e, f) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleState(codeOf(f)); }
    });

  statePaths.append('title');   // native tooltip = the accessible fallback

  gMesh.append('path')
    .attr('d', path(mesh))
    .attr('fill', 'none')
    .attr('stroke', PALETTE.present.bg)
    .attr('stroke-width', 0.7)
    .attr('pointer-events', 'none');

  function codeOf(f) {
    return byFips.get(String(f.id).padStart(2, '0'))?.state ?? null;
  }
  function toggleState(code) {
    if (!code) return;
    store.set({ selectedState: store.get().selectedState === code ? null : code });
  }

  // --- the ranked list beside the map --------------------------------------
  // Redundant encoding (§6): the same number the fill shows, on position and
  // length as well, sorted longest to shortest. Colour is never the only way
  // to read the ranking.
  const ranked = d3.select(root).select('#map-ranked');

  // --- render ---------------------------------------------------------------
  store.subscribe((s) => draw(s));

  function activeStates(s) {
    return s.showSmallBase ? states : states.filter((d) => !d.small_base);
  }

  function valueOf(d, s) {
    return s.measure === 'growth' ? d.growth_vs_national : d.mw_planned;
  }

  function fillFor(d, s) {
    if (!d) return PALETTE.present.noData;
    if (d.small_base && !s.showSmallBase) return 'url(#hatch-smallbase)';
    const v = valueOf(d, s);
    if (v == null || Number.isNaN(v)) return PALETTE.present.noData;
    return s.measure === 'growth' ? growthColor(v) : mwColor(v);
  }

  function draw(s) {
    const isGrowth = s.measure === 'growth';

    d3.select(root).select('#map-title').text(
      isGrowth
        ? 'The states building data centres fastest are not the states taking the most power'
        : 'Texas and Virginia hold two fifths of every megawatt in the US pipeline');

    d3.select(root).select('#map-sub').html(
      isGrowth
        ? `Shading: growth in computing-infrastructure establishments, Q1 2022 to Q1 2025,
           in percentage points <strong>above or below the national +${meta.national_estab_growth_pct}%</strong>.
           Circles: individual sites, area proportional to planned capacity in megawatts.`
        : `Shading: total <strong>planned</strong> capacity per state, megawatts.
           Circles: individual sites, area proportional to planned capacity in megawatts.`);

    statePaths
      .attr('fill', (f) => fillFor(byFips.get(String(f.id).padStart(2, '0')), s))
      .classed('is-selected', (f) => codeOf(f) === s.selectedState)
      .classed('is-hovered', (f) => codeOf(f) === s.hoveredState)
      .classed('is-dimmed', (f) => s.selectedState && codeOf(f) !== s.selectedState);

    statePaths.select('title').text((f) => {
      const d = byFips.get(String(f.id).padStart(2, '0'));
      if (!d) return 'No data';
      return `${d.state_name}: ${fmtSigned(d.growth_vs_national)} pts vs national, `
        + `${d3.format(',')(d.mw_planned)} MW planned`;
    });

    // --- dots: filtered by the MW slider and by the selected state ---------
    // This is a FILTER, not a highlight: sites below the floor are removed and
    // the caption recounts, so nothing silently claims to be the whole set.
    const visible = sites.filter((d) =>
      (d.capacity_mw ?? 0) >= s.minMW
      && (!s.selectedState || d.state === s.selectedState)
      && projection([d.lon, d.lat]));

    gDots.selectAll('g.site')
      .data(visible, (d) => d.name + d.state)
      .join(
        (enter) => {
          const g = enter.append('g').attr('class', 'site');
          g.append('path');
          g.append('title');
          return g;
        })
      .attr('transform', (d) => `translate(${projection([d.lon, d.lat])})`)
      .each(function (d) {
        const r = Math.max(2.2, radius(d.capacity_mw || 0));
        const planned = d.status === 'Planned';
        d3.select(this).select('path')
          .attr('vector-effect', 'non-scaling-stroke')
          // Shape carries status as well as hue: a planned site is a ring,
          // an operating site is a filled square. Survives greyscale (§6).
          .attr('d', planned
            ? d3.symbol(d3.symbolCircle, Math.PI * r * r)()
            : d3.symbol(d3.symbolSquare, Math.PI * r * r * 0.8)())
          .attr('fill', planned ? 'none' : PALETTE.status.Operating)
          .attr('fill-opacity', planned ? 0 : 0.8)
          .attr('stroke', PALETTE.status[d.status] ?? '#fff')
          .attr('stroke-width', planned ? 1.35 : 0.7)
          .attr('opacity', d.capacity_mw ? 0.92 : 0.45);
        d3.select(this).select('title').text(
          `${d.name}\n${d.company ?? 'operator not recorded'}\n`
          + `${d.status}${d.capacity_mw ? ` · ${d3.format(',')(d.capacity_mw)} MW` : ' · capacity not recorded'}`);
      });

    drawLegend(s, isGrowth);
    drawCaption(s, visible);
    drawDetail(s);
    drawRanked(s, isGrowth);
  }

  // --- legend ---------------------------------------------------------------
  function drawLegend(s, isGrowth) {
    gLegend.selectAll('*').remove();

    const w = 190; const h = 10;
    const scale = isGrowth ? growthColor : mwColor;
    const dom = isGrowth ? [-gExtent, gExtent] : [0, mwColor.domain()[1]];

    const id = 'legend-ramp';
    defs.select(`#${id}`).remove();
    const grad = defs.append('linearGradient').attr('id', id);
    d3.range(0, 1.001, 0.05).forEach((t) => {
      grad.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', scale(dom[0] + t * (dom[1] - dom[0])));
    });

    gLegend.append('rect')
      .attr('width', w).attr('height', h).attr('rx', 2)
      .attr('fill', `url(#${id})`)
      .attr('stroke', PALETTE.present.rule);

    // Ends labelled in words, not just numbers (§7).
    gLegend.append('text').attr('class', 'legend-label')
      .attr('y', -6).text(isGrowth
        ? `Growth vs the national +${meta.national_estab_growth_pct}%`
        : 'Planned capacity, megawatts');

    gLegend.append('text').attr('class', 'legend-end')
      .attr('y', h + 13).attr('text-anchor', 'start')
      .text(isGrowth ? 'slower' : '0 MW');
    gLegend.append('text').attr('class', 'legend-end')
      .attr('x', w).attr('y', h + 13).attr('text-anchor', 'end')
      .text(isGrowth ? 'faster' : `${d3.format(',')(Math.round(dom[1]))} MW`);

    if (isGrowth) {
      // The neutral colour sits exactly on zero, and zero is marked (§7).
      const x = w / 2;
      gLegend.append('line')
        .attr('x1', x).attr('x2', x).attr('y1', -2).attr('y2', h + 2)
        .attr('stroke', PALETTE.present.ink).attr('stroke-width', 1.5);
      gLegend.append('text').attr('class', 'legend-end')
        .attr('x', x).attr('y', h + 13).attr('text-anchor', 'middle')
        .text('national trend');
    }

    // Size legend: nested circles sharing a baseline, which is the only
    // layout that lets a reader compare AREA rather than diameter (§3).
    const sizeG = gLegend.append('g').attr('transform', `translate(${w + 74},0)`);
    const refs = [9200, 2000, 200];
    const rMax = radius(refs[0]);
    const baseY = h + 10;
    refs.forEach((mw) => {
      const r = radius(mw);
      sizeG.append('circle')
        .attr('cx', rMax).attr('cy', baseY - r).attr('r', r)
        .attr('fill', 'none').attr('stroke', PALETTE.status.Planned)
        .attr('stroke-width', 1.2).attr('opacity', 0.9);
      sizeG.append('line')
        .attr('x1', rMax).attr('x2', rMax * 2 + 10)
        .attr('y1', baseY - r * 2).attr('y2', baseY - r * 2)
        .attr('stroke', PALETTE.present.rule).attr('stroke-width', 0.8);
      sizeG.append('text').attr('class', 'legend-end')
        .attr('x', rMax * 2 + 14).attr('y', baseY - r * 2 + 4)
        .attr('text-anchor', 'start')
        .text(d3.format(',')(mw));
    });
    sizeG.append('text').attr('class', 'legend-label')
      .attr('y', baseY - rMax * 2 - 10).text('Site capacity, MW');

    const keyG = gLegend.append('g').attr('transform', `translate(${w + 250},0)`);
    keyG.append('text').attr('class', 'legend-label').attr('y', -6).text('Status');
    [['Planned', 0], ['Operating', 92]].forEach(([k, dx]) => {
      const planned = k === 'Planned';
      keyG.append('path')
        .attr('transform', `translate(${dx + 6},${h / 2})`)
        .attr('d', planned
          ? d3.symbol(d3.symbolCircle, 80)()
          : d3.symbol(d3.symbolSquare, 64)())
        .attr('fill', planned ? 'none' : PALETTE.status.Operating)
        .attr('stroke', PALETTE.status[k]).attr('stroke-width', 1.5);
      keyG.append('text').attr('class', 'legend-end')
        .attr('x', dx + 18).attr('y', h / 2 + 4).attr('text-anchor', 'start').text(k);
    });

    const hatchG = gLegend.append('g').attr('transform', `translate(${w + 250},30)`);
    hatchG.append('rect')
      .attr('width', 14).attr('height', 10).attr('y', -8)
      .attr('fill', 'url(#hatch-smallbase)')
      .attr('stroke', PALETTE.present.rule);
    hatchG.append('text').attr('class', 'legend-end')
      .attr('x', 20).attr('y', 0).attr('text-anchor', 'start')
      .text('fewer than 150 establishments in 2022');
  }

  // --- caption: every counting choice, on the chart (§1) --------------------
  function drawCaption(s, visible) {
    const total = sites.length;
    const n = visible.length;
    const mw = d3.sum(visible, (d) => d.capacity_mw || 0);
    const filtered = s.minMW > 0 || s.selectedState;
    d3.select(root).select('#map-caption').html(`
      Showing <strong>${d3.format(',')(n)}</strong> of ${d3.format(',')(total)} US
      sites${filtered ? ' (filtered)' : ''},
      <strong>${d3.format(',')(Math.round(mw))} MW</strong> of planned and operating
      capacity between them.
      Growth is Q1 2022 to Q1 2025; the window starts at 2022 because NAICS 518 was
      redefined in the 2022 revision and 2021 is not comparable.
      NAICS 518 covers computing infrastructure, data processing and web hosting, so it is
      a proxy for the sector's footprint, not a data centre census.
      ${d3.format(',')(sites.filter((d) => !d.capacity_mw).length)} sites have no recorded
      capacity; they are drawn at the minimum size when the megawatt floor is 0 and
      ${s.minMW > 0 ? 'are <strong>excluded at this threshold</strong>' : 'are included'}.
      Sources: BLS QCEW; datacentermap.com via ringmast4r/Global-Data-Center-Map.`);
  }

  // --- detail panel ---------------------------------------------------------
  function drawDetail(s) {
    const code = s.selectedState || s.hoveredState;
    const el = d3.select(root).select('#map-detail');
    if (!code || !byCode.has(code)) {
      el.html(`<p class="hint">Hover a state to read it. Click to lock the selection
               and filter the sites to that state.</p>`);
      return;
    }
    const d = byCode.get(code);
    el.html(`
      <h3>${d.state_name}</h3>
      <dl>
        <dt>Establishments, NAICS 518</dt>
        <dd>${d3.format(',')(d.estabs_2022)} &rarr; ${d3.format(',')(d.estabs_2025)}
            <span class="chip ${d.estab_growth_pct >= 0 ? 'up' : 'down'}">
            ${fmtSigned(d.estab_growth_pct)}%</span></dd>
        <dt>Against the national trend</dt>
        <dd>${fmtSigned(d.growth_vs_national)} percentage points</dd>
        <dt>Planned capacity</dt>
        <dd>${d3.format(',')(d.mw_planned)} MW across ${d.sites_planned} sites</dd>
        <dt>Operating capacity</dt>
        <dd>${d3.format(',')(d.mw_operating)} MW across ${d.sites_operating} sites</dd>
      </dl>
      ${d.small_base ? `<p class="warn">Fewer than 150 establishments in 2022.
        A handful of openings moves this percentage a long way.</p>` : ''}`);
  }

  // --- ranked bars ----------------------------------------------------------
  function drawRanked(s, isGrowth) {
    const data = activeStates(s)
      .filter((d) => valueOf(d, s) != null)
      .sort((a, b) => d3.descending(valueOf(a, s), valueOf(b, s)))
      .slice(0, 12);

    const max = d3.max(data, (d) => Math.abs(valueOf(d, s)));

    ranked.html(`<h3>${isGrowth ? 'Fastest growing' : 'Most planned capacity'}</h3>`);
    const rows = ranked.append('div').attr('class', 'bars')
      .selectAll('div').data(data).join('div')
      .attr('class', 'bar-row')
      .classed('is-selected', (d) => d.state === s.selectedState)
      .on('pointerenter', (e, d) => store.set({ hoveredState: d.state }))
      .on('pointerleave', () => store.set({ hoveredState: null }))
      .on('click', (e, d) => toggleState(d.state));

    rows.append('span').attr('class', 'bar-label').text((d) => d.state_name);
    rows.append('span').attr('class', 'bar-track')
      .append('span').attr('class', 'bar-fill')
      // Zero baseline, length proportional to value (§3: no lying channels).
      .style('width', (d) => `${(Math.abs(valueOf(d, s)) / max) * 100}%`)
      .style('background', (d) => isGrowth
        ? growthColor(valueOf(d, s)) : mwColor(valueOf(d, s)));
    rows.append('span').attr('class', 'bar-value')
      .text((d) => isGrowth
        ? `${fmtSigned(valueOf(d, s))} pts`
        : `${d3.format(',')(valueOf(d, s))} MW`);
  }

  // --- controls -------------------------------------------------------------
  function buildControls(el, meta) {
    el.innerHTML = `
      <div class="ctrl">
        <span class="ctrl-label">Shade states by</span>
        <div class="seg" role="radiogroup" aria-label="Measure">
          <button data-measure="growth" role="radio">Growth vs national</button>
          <button data-measure="mw" role="radio">Planned megawatts</button>
        </div>
      </div>
      <div class="ctrl">
        <label class="ctrl-label" for="mw-range">
          Show sites of at least <output id="mw-out">100</output> MW
        </label>
        <input id="mw-range" type="range" min="0" max="2000" step="25" value="100">
      </div>
      <div class="ctrl">
        <label class="check">
          <input id="small-base" type="checkbox">
          Include states with a tiny 2022 base
        </label>
      </div>
      <button class="reset" id="map-reset">Clear selection</button>`;

    el.querySelectorAll('[data-measure]').forEach((b) => {
      b.addEventListener('click', () => store.set({ measure: b.dataset.measure }));
    });
    const range = el.querySelector('#mw-range');
    const out = el.querySelector('#mw-out');
    range.addEventListener('input', () => {
      out.textContent = d3.format(',')(+range.value);
      store.set({ minMW: +range.value });
    });
    el.querySelector('#small-base').addEventListener('change', (e) => {
      store.set({ showSmallBase: e.target.checked });
    });
    el.querySelector('#map-reset').addEventListener('click', () => {
      store.resetMap();
      range.value = 100; out.textContent = '100';
      el.querySelector('#small-base').checked = false;
    });

    store.subscribe((s) => {
      el.querySelectorAll('[data-measure]').forEach((b) => {
        b.setAttribute('aria-checked', String(b.dataset.measure === s.measure));
        b.classList.toggle('is-on', b.dataset.measure === s.measure);
      });
    });
  }
}

function fmtSigned(v) {
  if (v == null || Number.isNaN(v)) return 'n/a';
  return (v > 0 ? '+' : '') + d3.format('.1f')(v);
}
