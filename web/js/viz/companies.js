/**
 * Viz 2 - "Which companies have the most data centers?"
 *
 * This one hangs on a billboard in the middle of the wasteland and is read
 * there, in the world. No overlay, no second page. That constrains how it is
 * built in two ways:
 *
 *  1. EVERYTHING lives inside one SVG - title, controls, chart, caption - with
 *     presentation attributes set inline rather than from the stylesheet,
 *     because the board paints the serialised SVG onto a canvas texture and
 *     external CSS does not survive that trip.
 *  2. There are no DOM listeners on the marks. The board raycasts to a UV
 *     coordinate, converts it to a point in this SVG's own coordinates and
 *     calls `hit()`. So every interactive thing registers a rectangle in
 *     `hotspots` and the hit test is arithmetic, not event bubbling.
 *
 * The chart itself is unchanged in substance. The sketch for it was a bubble
 * chart; bubbles put the only quantity on AREA, which the critique checklist
 * calls out in §6, so the default is sorted bars with a zero baseline and the
 * bubble form is a toggle so the two can be compared. The other toggle is the
 * finding: on the raw operator spellings Amazon AWS leads, and once the names
 * are resolved it drops to fourth.
 *
 * Channels (§3):
 *   bar length / bubble area   facilities      zero-anchored, sqrt for area
 *   bar position               rank            sorted by value, not by name
 *   colour                     rank 1 / hover  one accent, not a rainbow
 */

import * as store from '../store.js';

export const BOARD_W = 1600;
export const BOARD_H = 900;

// The board is lit by a dying sun, so the chart runs warm.
const INK = '#F6E7D2';
const DIM = '#C3A985';
const RULE = '#6B5236';
const PANEL = '#17100A';
const ACCENT = '#F0A93C';
const BASE = '#8A7256';

const MONO = '"Courier New", monospace';
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';

export async function createBoardChart() {
  const [top, audit] = await Promise.all([
    d3.csv('data/companies_top25.csv', d3.autoType),
    d3.csv('data/companies_merge_audit.csv', d3.autoType),
  ]);

  // Rebuild the pre-cleaning ranking from the audit trail: each raw spelling
  // standing on its own, exactly as the directory files it.
  const rawRows = [];
  const merged = d3.group(audit, (d) => d.company);
  for (const row of top) {
    const parts = merged.get(row.company);
    if (parts) parts.forEach((p) => rawRows.push({ company: p.company_raw, facilities: p.facilities }));
    else rawRows.push({ company: row.company, facilities: row.facilities });
  }
  rawRows.sort((a, b) => d3.descending(a.facilities, b.facilities));

  const svg = d3.create('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', BOARD_W).attr('height', BOARD_H)
    .attr('viewBox', `0 0 ${BOARD_W} ${BOARD_H}`)
    .attr('role', 'img')
    .attr('font-family', SANS);

  svg.append('title').text('Which companies operate the most data centres');
  const desc = svg.append('desc');
  svg.append('rect').attr('width', BOARD_W).attr('height', BOARD_H).attr('fill', PANEL);

  const gHead = svg.append('g');
  const gCtrl = svg.append('g');
  const gMarks = svg.append('g');
  const gAxis = svg.append('g');
  const gFoot = svg.append('g');

  /** Clickable rectangles in SVG coordinates, rebuilt on every draw. */
  let hotspots = [];
  let onChange = () => {};

  // Fixed bands. The previous layout chained the subtitle's position off how
  // many lines the title wrapped to, and the subtitle landed on the first bar.
  const BAND = { eyebrow: 46, title: 104, titleLead: 48, sub: 208, subLead: 26 };
  const M = { t: 266, r: 150, b: 175, l: 330 };

  function rowsFor(s) {
    return (s.measureCompanies === 'clean' ? top : rawRows).slice(0, 12);
  }

  function draw(s) {
    hotspots = [];
    const clean = s.measureCompanies === 'clean';
    const rows = rowsFor(s);
    const leader = rows[0];

    gHead.selectAll('*').remove();
    gHead.append('text')
      .attr('x', 48).attr('y', BAND.eyebrow)
      .attr('fill', DIM).attr('font-family', MONO).attr('font-size', 19)
      .attr('letter-spacing', 3)
      .text('DATA CENTER TOWN · MUNICIPAL BOARD OF RECORDS · POSTED 2126');

    wrap(gHead, clean
      ? `${leader.company} operates more data centres than anyone else`
      : 'On the raw spellings, Amazon AWS looks like the leader',
    { x: 48, y: BAND.title, width: 1040, size: 42, weight: 650, fill: INK, lead: BAND.titleLead });

    wrap(gHead, clean
      ? 'Operator names resolved: duplicate spellings merged, acquired brands rolled into their parent.'
      : 'Every spelling counted separately. Amazon and Amazon AWS are one company; CenturyLink has been Lumen since 2020.',
    { x: 48, y: BAND.sub, width: 1040, size: 21, fill: DIM, lead: BAND.subLead });

    // Controls are drawn as marks, because the board has no DOM to hang
    // buttons off. They register hotspots like everything else.
    gCtrl.selectAll('*').remove();
    seg(gCtrl, 1148, 52, 'NAMES', [['Resolved', 'clean'], ['As filed', 'raw']],
      s.measureCompanies, (v) => store.set({ measureCompanies: v }));
    seg(gCtrl, 1148, 136, 'FORM', [['Bars', 'bars'], ['Bubbles', 'bubbles']],
      s.companyForm, (v) => store.set({ companyForm: v }));

    if (s.companyForm === 'bars') bars(rows, s); else bubbles(rows, s);

    gFoot.selectAll('*').remove();
    wrap(gFoot, `Top ${rows.length} of ${clean ? '3,999 resolved operators' : '4,079 raw operator spellings'} `
      + 'across 24,174 facilities. A facility is one directory entry, not one building and not one megawatt: '
      + 'a small colocation suite counts the same as a hyperscale campus. '
      + (clean
        ? 'Acquired brands are rolled into their parent, so this is who operates them today. '
        : 'Nothing is merged here, so one company can appear more than once. ')
      + '99 facilities have no recorded operator and are excluded. '
      + 'Source: datacentermap.com via ringmast4r/Global-Data-Center-Map.',
    { x: 48, y: BOARD_H - 88, width: BOARD_W - 96, size: 20, fill: '#D8BF9B', lead: 26 });

    desc.text(rows.map((d, i) => `${i + 1}. ${d.company}, ${d.facilities} facilities`).join('; '));
    onChange();
  }

  function bars(rows, s) {
    const top1 = rows[0].company;
    const x = d3.scaleLinear()
      .domain([0, d3.max(rows, (d) => d.facilities)]).nice()
      .range([M.l, BOARD_W - M.r]);
    // Sorted longest to shortest. Never alphabetical when magnitude is the point.
    const y = d3.scaleBand()
      .domain(rows.map((d) => d.company))
      .range([M.t, BOARD_H - M.b])
      .padding(0.24);

    gMarks.selectAll('*').remove();

    rows.forEach((d) => {
      const dim = s.selectedCompany && s.selectedCompany !== d.company;
      gMarks.append('rect')
        .attr('x', x(0))                     // zero baseline, always
        .attr('y', y(d.company))
        .attr('width', x(d.facilities) - x(0))
        .attr('height', y.bandwidth())
        .attr('rx', 3)
        .attr('fill', d.company === top1 ? ACCENT : BASE)
        .attr('opacity', dim ? 0.3 : 1);

      gMarks.append('text')
        .attr('x', x(d.facilities) + 14)
        .attr('y', y(d.company) + y.bandwidth() / 2).attr('dy', '0.35em')
        .attr('fill', INK).attr('font-size', 22).attr('font-family', MONO)
        .attr('opacity', dim ? 0.4 : 1)
        .text(d3.format(',')(d.facilities));

      gMarks.append('text')
        .attr('x', M.l - 18)
        .attr('y', y(d.company) + y.bandwidth() / 2).attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('fill', d.company === top1 ? INK : DIM)
        .attr('font-size', 23)
        .attr('font-weight', d.company === top1 ? 650 : 400)
        .attr('opacity', dim ? 0.45 : 1)
        .text(d.company);

      // The whole row is the target, not just the bar. A 26px bar read from
      // ten metres across a wasteland is not something anyone can point at.
      hotspots.push({
        x: 40, y: y(d.company), w: BOARD_W - 80, h: y.bandwidth(),
        hover: () => store.set({ selectedCompany: d.company }),
      });
    });

    gAxis.selectAll('*').remove();
    const axisY = BOARD_H - M.b + 8;
    gAxis.append('line')
      .attr('x1', x(0)).attr('x2', x.range()[1]).attr('y1', axisY).attr('y2', axisY)
      .attr('stroke', RULE).attr('stroke-width', 2);
    x.ticks(6).forEach((t) => {
      gAxis.append('line')
        .attr('x1', x(t)).attr('x2', x(t)).attr('y1', axisY).attr('y2', axisY + 9)
        .attr('stroke', RULE).attr('stroke-width', 2);
      gAxis.append('text')
        .attr('x', x(t)).attr('y', axisY + 31).attr('text-anchor', 'middle')
        .attr('fill', DIM).attr('font-size', 18).attr('font-family', MONO)
        .text(d3.format(',')(t));
    });
    gAxis.append('text')
      .attr('x', (x(0) + x.range()[1]) / 2).attr('y', axisY + 58)
      .attr('text-anchor', 'middle').attr('fill', DIM).attr('font-size', 18)
      .text('Data centre facilities in the directory');
  }

  function bubbles(rows, s) {
    const top1 = rows[0].company;
    gAxis.selectAll('*').remove();
    gMarks.selectAll('*').remove();

    // Area proportional to value: sqrt, anchored at zero (§3).
    const r = d3.scaleSqrt()
      .domain([0, d3.max(rows, (d) => d.facilities)])
      .range([0, 108]);

    const cx = BOARD_W / 2;
    const cy = (M.t + BOARD_H - M.b) / 2;
    const nodes = rows.map((d) => ({ ...d, r: r(d.facilities) }));
    const sim = d3.forceSimulation(nodes)
      .force('x', d3.forceX(cx).strength(0.05))
      .force('y', d3.forceY(cy).strength(0.12))
      .force('collide', d3.forceCollide((d) => d.r + 4).strength(0.9))
      .stop();
    for (let i = 0; i < 260; i += 1) sim.tick();

    nodes.forEach((d) => {
      gMarks.append('circle')
        .attr('cx', d.x).attr('cy', d.y).attr('r', d.r)
        .attr('fill', d.company === top1 ? ACCENT : BASE)
        .attr('opacity', !s.selectedCompany || s.selectedCompany === d.company ? 0.95 : 0.26);

      // Light ink with a dark halo. Dark ink on a dark fill failed 4.5:1
      // outright, and on a sunlit board it disappeared completely.
      if (d.r > 44 && d.company.length * 10 < d.r * 2.1) {
        const t = gMarks.append('text')
          .attr('text-anchor', 'middle').attr('x', d.x).attr('y', d.y)
          .attr('fill', '#FFF6E8')
          .attr('stroke', 'rgba(14,9,4,0.9)').attr('stroke-width', 4)
          .attr('paint-order', 'stroke')
          .attr('font-size', Math.min(22, Math.max(15, d.r / 4)));
        t.append('tspan').attr('x', d.x).attr('dy', '-0.1em').text(d.company);
        t.append('tspan').attr('x', d.x).attr('dy', '1.25em')
          .attr('font-weight', 700).text(d3.format(',')(d.facilities));
      }

      hotspots.push({
        x: d.x - d.r, y: d.y - d.r, w: d.r * 2, h: d.r * 2,
        hover: () => store.set({ selectedCompany: d.company }),
      });
    });

    // Say out loud why this form is the weaker one.
    gMarks.append('text')
      .attr('x', 48).attr('y', BOARD_H - M.b + 34)
      .attr('fill', DIM).attr('font-size', 18)
      .text('Area encodes the count. Compare Equinix and Lumen here, then switch to bars: '
        + 'the 37-facility gap is almost invisible as area.');
  }

  function seg(g, x, y, label, options, current, onPick) {
    g.append('text')
      .attr('x', x).attr('y', y - 12)
      .attr('fill', DIM).attr('font-family', MONO).attr('font-size', 17)
      .attr('letter-spacing', 2)
      .text(label);

    let cx = x;
    options.forEach(([text, value]) => {
      const w = text.length * 13 + 42;
      const on = current === value;
      g.append('rect')
        .attr('x', cx).attr('y', y).attr('width', w).attr('height', 46).attr('rx', 6)
        .attr('fill', on ? ACCENT : 'none')
        .attr('stroke', on ? ACCENT : RULE).attr('stroke-width', 2);
      g.append('text')
        .attr('x', cx + w / 2).attr('y', y + 30).attr('text-anchor', 'middle')
        .attr('fill', on ? '#1B1206' : DIM)
        .attr('font-size', 21).attr('font-weight', on ? 650 : 400)
        .text(text);
      hotspots.push({ x: cx, y, w, h: 46, click: () => onPick(value) });
      cx += w + 10;
    });
  }

  /** SVG will not wrap text, so measure by character width and break by hand. */
  function wrap(g, text, { x, y, width, size, fill, lead, weight = 400 }) {
    const max = Math.floor(width / (size * 0.54));
    const lines = [];
    let line = '';
    text.split(/\s+/).forEach((w) => {
      if ((`${line} ${w}`).trim().length > max) { lines.push(line.trim()); line = w; }
      else line = (`${line} ${w}`).trim();
    });
    if (line) lines.push(line);
    lines.forEach((ln, i) => {
      g.append('text')
        .attr('x', x).attr('y', y + i * lead)
        .attr('fill', fill).attr('font-size', size).attr('font-weight', weight)
        .text(ln);
    });
    return lines.length;
  }

  store.subscribe(draw);

  return {
    node: svg.node(),
    width: BOARD_W,
    height: BOARD_H,

    /** Called by the board with a point in this SVG's own coordinates. */
    hit(px, py, kind) {
      const found = [...hotspots].reverse().find((h) =>
        px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h);
      if (!found) {
        if (kind === 'move' && store.get().selectedCompany) {
          store.set({ selectedCompany: null });
        }
        return false;
      }
      if (kind === 'click' && found.click) { found.click(); return true; }
      if (kind === 'move' && found.hover) { found.hover(); return true; }
      return Boolean(found.click);
    },

    /** Clear the hover when the pointer leaves the board entirely. */
    leave() { store.set({ selectedCompany: null }); },

    /** The board subscribes so it knows when to repaint its texture. */
    onRedraw(fn) { onChange = fn; fn(); },
  };
}

/** The winner's name, for the town sign. Read before the world is built. */
export async function leadingCompany() {
  const top = await d3.csv('data/companies_top25.csv', d3.autoType);
  return top[0];
}
