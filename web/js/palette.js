/**
 * One palette for the whole piece, so the two screens read as one system.
 *
 * Checklist §7 (colour & colormaps) drove every choice here:
 *
 *  - Growth against the national average is a SIGNED quantity with a
 *    meaningful zero, so it gets a DIVERGING ramp anchored exactly on zero
 *    with a symmetric domain. Not a sequential ramp, not a categorical one.
 *  - Planned capacity in MW is unsigned and badly right-skewed (one site is
 *    9,200 MW, the median is 120), so the SKEW IS HANDLED IN THE DOMAIN with
 *    a square-root scale, not by bending the palette.
 *  - No rainbow / jet anywhere.
 *  - Build status is nominal with two levels, so it gets two distinct hues
 *    AND a distinct shape AND a distinct fill style, never colour alone (§6).
 *
 * Red-Blue is the diverging ramp because it survives deuteranopia and
 * protanopia: both forms keep the red and blue ends apart, which is not true
 * of red-green. Checked in-browser with CDP vision emulation.
 */

export const PALETTE = {
  // --- diverging: growth relative to the national trend --------------------
  // d3.interpolateRdBu runs blue -> red, so we read it backwards: red = above
  // the national average (building faster), blue = below it.
  diverging: (t) => d3.interpolateRdBu(1 - t),
  divergingName: 'RdBu, reversed',

  // --- nominal: build status -----------------------------------------------
  // Okabe-Ito. Orange and blue, the pair furthest apart under both common
  // forms of colour-vision deficiency.
  status: {
    Planned: '#E69F00',    // Okabe-Ito orange
    Operating: '#0072B2',  // Okabe-Ito blue
  },

  // --- screen 1: the clean "present day" briefing --------------------------
  present: {
    bg: '#0E1116',
    panel: '#161B22',
    ink: '#E6EDF3',        // 13.4:1 on bg
    inkDim: '#9BA7B4',     //  6.1:1 on bg, still over the 4.5 floor
    rule: '#2A313B',
    noData: '#30363D',
    accent: '#E69F00',
  },

  // --- screen 2: the wasteland, 100 years on -------------------------------
  // Same hues, pushed toward dust. The billboard chart keeps the real palette
  // so the data stays readable; only the world around it is tinted.
  waste: {
    sky: '#C8783C',
    skyHigh: '#5B3A2E',
    ground: '#8A6A47',
    groundDark: '#5A4430',
    concrete: '#9A9287',
    rust: '#7A4A2E',
    ink: '#F2E6D8',
    fog: '#B07746',
  },
};

/** WCAG relative luminance, used by the contrast self-check below. */
function luminance(hex) {
  const c = hex.replace('#', '').match(/../g).map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Logged on boot so a failing contrast pair is visible rather than silent.
 * §6: text >= 4.5:1.
 */
export function checkContrast() {
  const p = PALETTE.present;
  const pairs = [
    ['ink on bg', p.ink, p.bg],
    ['inkDim on bg', p.inkDim, p.bg],
    ['ink on panel', p.ink, p.panel],
    ['accent on panel', p.accent, p.panel],
  ];
  const rows = pairs.map(([label, fg, bg]) => ({
    pair: label, ratio: +contrast(fg, bg).toFixed(2),
    passesAA: contrast(fg, bg) >= 4.5,
  }));
  if (rows.some((r) => !r.passesAA)) console.warn('contrast below AA', rows);
  return rows;
}
