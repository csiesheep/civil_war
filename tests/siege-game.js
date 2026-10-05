// The check of a bot's 圍點打援 decision (#27), shared by tests/bots.test.js and tests/bots-chunk.js.
// Orchestrator's file.
const CCP = 0;
export const kindOf = (id) => String(id).split(":")[0];
// The bot's `game` (#27): rows are the Communists' plans, cols the Nationalists' answers, values[i][j] the
// deciding side's evaluation; `mix` is the decider's strategy (over rows for 共軍, over cols for 國軍),
// `against` the other side's, `value` the game's value for the decider. Checked here, not trusted: each mix a
// distribution over its own labels; the decider's mix holds every pure reply to at least `value`; the other
// side's mix holds every pure strategy of the decider to at most `value`.
export function gameFault(g, side, labels) {
  if (!g || !Array.isArray(g.rows) || !Array.isArray(g.cols) || !Array.isArray(g.values)) return "no game (rows / cols / values)";
  if (JSON.stringify(g.rows) !== JSON.stringify(["point", "relief"])) return `rows ${JSON.stringify(g.rows)}`;
  if (labels && JSON.stringify([...g.cols].sort()) !== JSON.stringify([...labels].sort())) return `cols ${JSON.stringify(g.cols)} are not the options ${JSON.stringify(labels)}`;
  const mine = side === CCP ? g.rows : g.cols, theirs = side === CCP ? g.cols : g.rows;
  const dist = (m, keys, what) => {
    if (!m) return `no ${what}`;
    for (const k of Object.keys(m)) if (!keys.includes(k)) return `${what} names ${k}`;
    const p = keys.map((k) => m[k] || 0);
    if (p.some((x) => !(x >= -1e-9))) return `${what} has a negative`;
    if (Math.abs(p.reduce((a, b) => a + b, 0) - 1) > 1e-6) return `${what} does not sum to 1`;
    return null;
  };
  const f = dist(g.mix, mine, "mix") || dist(g.against, theirs, "against"); if (f) return f;
  const V = (i, j) => g.values[i][j], R = g.rows.length, C = g.cols.length;
  const big = Math.max(1, ...g.values.flat().map(Math.abs)), eps = 1e-6 * big;
  const p = (i) => (side === CCP ? g.mix : g.against)[g.rows[i]] || 0, q = (j) => (side === CCP ? g.against : g.mix)[g.cols[j]] || 0;
  if (side === CCP) {
    for (let j = 0; j < C; j++) { let v = 0; for (let i = 0; i < R; i++) v += p(i) * V(i, j); if (v < g.value - eps) return `共軍的 mix gets ${v} < value ${g.value} against ${g.cols[j]}`; }
    for (let i = 0; i < R; i++) { let v = 0; for (let j = 0; j < C; j++) v += q(j) * V(i, j); if (v > g.value + eps) return `${g.rows[i]} gets ${v} > value ${g.value} against 國軍's mix`; }
  } else {
    for (let i = 0; i < R; i++) { let v = 0; for (let j = 0; j < C; j++) v += q(j) * V(i, j); if (v < g.value - eps) return `國軍's mix gets ${v} < value ${g.value} against ${g.rows[i]}`; }
    for (let j = 0; j < C; j++) { let v = 0; for (let i = 0; i < R; i++) v += p(i) * V(i, j); if (v > g.value + eps) return `${g.cols[j]} gets ${v} > value ${g.value} against 共軍's mix`; }
  }
  return null;
}
