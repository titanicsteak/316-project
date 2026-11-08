/**
 * Viz 2 - "Which companies have the most data centers?"
 *
 * This is the billboard inside Data Center Town, so it has a second job: the
 * town is named after whoever wins this chart, and the chart has to earn that.
 *
 * The sketch for this one was a bubble chart. Bubbles put the only quantity in
 * the chart on AREA, which §6 calls out: the most important comparison belongs
 * on position. So the default is a sorted bar chart, longest to shortest, with
 * a zero baseline - and the bubble form is kept behind a toggle so the two can
 * be compared directly. Switching between them is the argument.
 *
 * The second toggle is the real finding. On the raw operator names Amazon AWS
 * leads. After the directory's spellings are resolved - "Amazon" and
 * "Amazon AWS" are one company, "CenturyLink" is now Lumen, "Interxion" is now
 * Digital Realty - Amazon drops to fourth and three colocation landlords come
 * out ahead of the cloud brands. The chart has to say which version it shows.
 *
 * Channels (§3):
 *   bar length / bubble area   facilities        zero-anchored, sqrt for area
 *   bar position               rank              sorted by value, not name
 *   colour                     is the selection  one accent, not a rainbow
 */

import { PALETTE } from '../palette.js';
import * as store from '../store.js';

export async function renderCompanies(root, { theme = 'present' } = {}) {
  const [top, audit] = await Promise.all([
    d3.csv('data/companies_top25.csv', d3.autoType),
    d3.csv('data/companies_merge_audit.csv', d3.autoType),
  ]);

  // Reconstruct the pre-cleaning ranking from the audit trail: each raw
  // spelling standing on its own, exactly as the directory files it.
  const rawRows = [];
  const merged = d3.group(audit, (d) => d.company);
  for (const row of top) {
    const parts = merged.get(row.company);
    if (parts) parts.forEach((p) => rawRows.push({ company: p.company_raw, facilities: p.facilities }));
    else rawRows.push({ company: row.company, facilities: row.facilities });
  }
  rawRows.sort((a, b) => d3.descending(a.facilities, b.facilities));

  const ink = theme === 'waste' ? PALETTE.waste.ink : PALETTE.present.ink;
  const dim = theme === 'waste' ? '#C9B49C' : PALETTE.present.inkDim;
  const accent = theme === 'waste' ? '#E8A33D' : PALETTE.present.accent;
  const base = theme === 'waste' ? '#7E6A52' : '#4C5A68';
  

  root.innerHTML = `
    <header class="viz-head">
      <h2 id="co-title"></h2>
      <p class="sub" id="co-sub"></p>
    </header>
    <div class="co-controls" id="co-controls"></div>
    <figure class="co-figure">
      <svg id="co-svg" role="img" aria-labelledby="co-title"></svg>
      <figcaption id="co-caption"></figcaption>
    </figure>`;

  buildControls(root.querySelector('#co-controls'));

  const svg = d3.select(root).select('#co-svg');
  const W = 820; const H = 560;
  const M = { t: 24, r: 90, b: 46, l: 182 };
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');

  const gMarks = svg.append('g');
  const gAxis = svg.append('g');
  const gNote = svg.append('g');

  store.subscribe((s) => draw(s));

  function currentData(s) {
    return (s.measureCompanies === 'clean' ? top : rawRows).slice(0, 14);
  }

  function draw(s) {
    const clean = s.measureCompanies === 'clean';
    const data = currentData(s);
    const leader = data[0];

    d3.select(root).select('#co-title').text(
      clean
        ? `${leader.company} operates more data centres than anyone else`
        : 'On the directory’s raw spellings, Amazon AWS looks like the leader');

    d3.select(root).select('#co-sub').html(
      clean
        ? `Operator names resolved: duplicate spellings merged and acquired brands rolled into
           their parent. <strong>${leader.company} ${d3.format(',')(leader.facilities)}</strong> facilities.`
        : `Every spelling counted separately, the way the directory files it.
           <strong>Amazon</strong> and <strong>Amazon AWS</strong> are the same company;
           <strong>CenturyLink</strong> has been Lumen since 2020.`);

    if (s.companyForm === 'bars') drawBars(data, s);
    else drawBubbles(data, s);

    drawCaption(s, data);
  }

  // --- bars ------------------------------------------------------------------
  function drawBars(data, s) {
    gNote.selectAll('*').remove();
    const top1 = data[0].company;

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, (d) => d.facilities)]).nice()
      .range([M.l, W - M.r]);
    // Sorted longest to shortest. Never alphabetical when magnitude is the point.
    const y = d3.scaleBand()
      .domain(data.map((d) => d.company))
      .range([M.t, H - M.b])
      .padding(0.22);

    const t = svg.transition().duration(450).ease(d3.easeCubicOut);

    gMarks.selectAll('rect.bar')
      .data(data, (d) => d.company)
      .join(
        (e) => e.append('rect').attr('class', 'bar')
          .attr('x', x(0)).attr('width', 0)
          .attr('y', (d) => y(d.company)).attr('height', y.bandwidth()),
        (u) => u,
        (ex) => ex.transition(t).attr('width', 0).remove())
      .attr('rx', 2)
      .on('pointerenter', (e, d) => store.set({ selectedCompany: d.company }))
      .on('pointerleave', () => store.set({ selectedCompany: null }))
      // Fill is set outside the transition on purpose. Interpolating it meant a
      // second redraw caught the first mid-interpolation and left the ranking
      // wearing half-blended colours.
      .attr('fill', (d) => (d.company === top1 ? accent : base))
      .attr('opacity', (d) => (!s.selectedCompany || s.selectedCompany === d.company ? 1 : 0.35))
      .transition(t)
      .attr('x', x(0))                       // zero baseline, always
      .attr('y', (d) => y(d.company))
      .attr('height', y.bandwidth())
      .attr('width', (d) => x(d.facilities) - x(0));

    gMarks.selectAll('text.value')
      .data(data, (d) => d.company)
      .join('text').attr('class', 'value')
      .attr('dy', '0.35em').attr('fill', ink).attr('font-size', 13)
      .transition(t)
      .attr('x', (d) => x(d.facilities) + 8)
      .attr('y', (d) => y(d.company) + y.bandwidth() / 2)
      .text((d) => d3.format(',')(d.facilities));

    gMarks.selectAll('circle.bubble').transition(t).attr('r', 0).remove();
    gMarks.selectAll('text.bubble-label').remove();

    gAxis.selectAll('*').remove();
    gAxis.append('g')
      .attr('transform', `translate(0,${H - M.b})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format(',')))
      .call((g) => g.select('.domain').attr('stroke', dim))
      .call((g) => g.selectAll('text').attr('fill', dim).attr('font-size', 12))
      .call((g) => g.selectAll('line').attr('stroke', dim))
      .append('text')
      .attr('x', (M.l + W - M.r) / 2).attr('y', 38)
      .attr('fill', dim).attr('font-size', 12).attr('text-anchor', 'middle')
      .text('Data centre facilities in the directory');

    gAxis.append('g')
      .attr('transform', `translate(${M.l},0)`)
      .call(d3.axisLeft(y).tickSize(0))
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('text')
        .attr('fill', (d) => (d === top1 ? ink : dim))
        .attr('font-weight', (d) => (d === top1 ? 600 : 400))
        .attr('font-size', 13));
  }

  // --- bubbles (the original sketch, kept for the comparison) ---------------
  function drawBubbles(data, s) {
    gAxis.selectAll('*').remove();
    gMarks.selectAll('rect.bar').transition().duration(300).attr('width', 0).remove();
    gMarks.selectAll('text.value').remove();

    const top1 = data[0].company;

    // Area proportional to value: sqrt, anchored at zero (§3).
    const r = d3.scaleSqrt()
      .domain([0, d3.max(data, (d) => d.facilities)])
      .range([0, 74]);

    const nodes = data.map((d) => ({ ...d, r: r(d.facilities) }));
    const sim = d3.forceSimulation(nodes)
      .force('x', d3.forceX(W / 2).strength(0.06))
      .force('y', d3.forceY(H / 2).strength(0.1))
      .force('collide', d3.forceCollide((d) => d.r + 2).strength(0.9))
      .stop();
    for (let i = 0; i < 220; i += 1) sim.tick();

    const sel = gMarks.selectAll('circle.bubble')
      .data(nodes, (d) => d.company)
      .join('circle').attr('class', 'bubble')
      .on('pointerenter', (e, d) => store.set({ selectedCompany: d.company }))
      .on('pointerleave', () => store.set({ selectedCompany: null }));

    sel.attr('fill', (d) => (d.company === top1 ? accent : base))
      .attr('opacity', (d) => (!s.selectedCompany || s.selectedCompany === d.company ? 0.92 : 0.3))
      .transition().duration(450)
      .attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('r', (d) => d.r);

    // Every circle carries its name natively, so the ones too small to label
    // are still identifiable.
    sel.each(function (d) {
      let tt = this.querySelector('title');
      if (!tt) {
        tt = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        this.appendChild(tt);
      }
      tt.textContent = `${d.company}: ${d3.format(',')(d.facilities)} facilities`;
    });

    // Labels: light ink with a dark halo rather than dark ink on a dark fill,
    // which failed the 4.5:1 floor outright. A name only appears when the
    // circle is wide enough to hold it.
    const fits = (d) => d.r > 30 && d.company.length * 6.6 < d.r * 2;
    gMarks.selectAll('text.bubble-label')
      .data(nodes.filter(fits), (d) => d.company)
      .join('text').attr('class', 'bubble-label')
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFF6E8')
      .attr('stroke', 'rgba(16,10,5,0.9)')
      .attr('stroke-width', 3)
      .attr('paint-order', 'stroke')
      .attr('pointer-events', 'none')
      .attr('font-size', (d) => Math.min(14, Math.max(10, d.r / 3.6)))
      .attr('x', (d) => d.x).attr('y', (d) => d.y)
      .call((t) => {
        t.selectAll('tspan').remove();
        t.append('tspan').attr('x', (d) => d.x).attr('dy', '-0.1em')
          .text((d) => d.company);
        t.append('tspan').attr('x', (d) => d.x).attr('dy', '1.25em')
          .attr('font-weight', 700).text((d) => d3.format(',')(d.facilities));
      });

    // Say out loud why this form is the weaker one.
    gNote.selectAll('*').remove();
    gNote.append('text')
      .attr('x', 16).attr('y', H - 14).attr('fill', dim).attr('font-size', 12)
      .text('Area encodes the count. Compare Equinix and Lumen here, then switch to bars: '
        + 'the 37-facility gap is almost invisible as area.');
  }

  function drawCaption(s, data) {
    const clean = s.measureCompanies === 'clean';
    d3.select(root).select('#co-caption').html(`
      Top ${data.length} of ${clean ? '3,999 resolved operators' : '4,079 raw operator spellings'}
      across 24,174 facilities. A facility is one entry in the directory, not one building and
      not one megawatt: a small colocation suite counts the same as a hyperscale campus.
      ${clean
        ? 'Acquired brands are rolled into their parent (CenturyLink into Lumen, Interxion into Digital Realty), so this is who operates them today.'
        : 'Nothing is merged here, so one company can appear more than once.'}
      99 facilities have no recorded operator and are excluded.
      Source: datacentermap.com via ringmast4r/Global-Data-Center-Map.`);
  }

  function buildControls(el) {
    el.innerHTML = `
      <div class="ctrl">
        <span class="ctrl-label">Operator names</span>
        <div class="seg" role="radiogroup" aria-label="Name resolution">
          <button data-co="clean" role="radio">Resolved</button>
          <button data-co="raw" role="radio">As filed</button>
        </div>
      </div>
      <div class="ctrl">
        <span class="ctrl-label">Chart form</span>
        <div class="seg" role="radiogroup" aria-label="Chart form">
          <button data-form="bars" role="radio">Sorted bars</button>
          <button data-form="bubbles" role="radio">Bubbles</button>
        </div>
      </div>`;

    el.querySelectorAll('[data-co]').forEach((b) =>
      b.addEventListener('click', () => store.set({ measureCompanies: b.dataset.co })));
    el.querySelectorAll('[data-form]').forEach((b) =>
      b.addEventListener('click', () => store.set({ companyForm: b.dataset.form })));

    store.subscribe((s) => {
      el.querySelectorAll('[data-co]').forEach((b) => {
        const on = b.dataset.co === s.measureCompanies;
        b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on));
      });
      el.querySelectorAll('[data-form]').forEach((b) => {
        const on = b.dataset.form === s.companyForm;
        b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on));
      });
    });
  }

  return { leader: () => top[0].company };
}

/** The winner's name, for the town sign. Read before the billboard opens. */
export async function leadingCompany() {
  const top = await d3.csv('data/companies_top25.csv', d3.autoType);
  return top[0];
}
