/**
 * The single selection state for the whole piece.
 *
 * Checklist §4 asks for exactly one selection state that every view derives
 * from, so there is one object here and every view subscribes to it. No view
 * reads the full dataset while a sibling is filtered.
 */

const state = {
  // screen 1
  measure: 'growth',     // 'growth' | 'mw'   (Encode intent)
  selectedState: null,   // USPS code         (Select intent)
  hoveredState: null,
  minMW: 100,            // MW floor on the dot overlay (Filter intent)
  showSmallBase: false,  // include states with a tiny 2022 base

  // screen 2
  measureCompanies: 'clean', // 'clean' | 'raw'
  companyForm: 'bars',       // 'bars' | 'bubbles'
  selectedCompany: null,
};

const listeners = new Set();

export function get() {
  return state;
}

export function set(patch) {
  let changed = false;
  for (const [k, v] of Object.entries(patch)) {
    if (state[k] !== v) { state[k] = v; changed = true; }
  }
  if (changed) listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

/** The obvious way back to the full view (§4: the selection can be cleared). */
export function resetMap() {
  set({ selectedState: null, hoveredState: null, minMW: 100, showSmallBase: false });
}
