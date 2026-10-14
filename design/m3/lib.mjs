// design/m3/lib.mjs -- what the four mockup pages share: the map, the top bar, the tracks, the hand.
// Nothing about the game is written down here: the spaces, adjacency, cards and thresholds come from the
// engine (public/shared), the position of each space on the page is the one thing this file adds (LAYOUT),
// and `h()` is a six-line stand-in for a framework.
import * as E from "../../public/shared/engine.js";
export { E };
import "./audit.mjs"; // window.audit(): sideways scroll, 44 px targets, 4.5:1 contrast (see audit.mjs)

if (/[?&]shot/.test(location.search)) document.documentElement.classList.add("shot"); // headless screenshots: the window is wider than 390, keep the page at the left
export const SVGNS = "http://www.w3.org/2000/svg";
export function h(tag, props, ...kids) {
  const svg = tag.startsWith("svg:");
  const el = svg ? document.createElementNS(SVGNS, tag.slice(4)) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.setAttribute("class", v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  const add = (x) => { if (Array.isArray(x)) x.forEach(add); else if (x != null && x !== false) el.append(x.nodeType ? x : document.createTextNode(String(x))); };
  kids.forEach(add);
  return el;
}
export async function loadState(name) {
  const r = await fetch(name, { cache: "no-store" });
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.json();
}

// ---------- where each space sits (col, row) on a 7 x 10 grid, west to east, north to south ----------
export const LAYOUT = {
  changchun: [5, 0], beiman: [6, 0], siping: [6, 1],
  chasui: [1, 2], liaoxi: [5, 2], shenyang: [6, 2],
  taiyuan: [2, 3], beiping: [4, 3], jinzhou: [5, 3],
  taihang: [3, 4], jizhong: [4, 4], tianjin: [5, 4],
  shanbei: [0, 5], jinzhong: [1, 5], jiluyu: [4, 5], jinan: [5, 5],
  lanzhou: [0, 6], xian: [1, 6], zhengzhou: [3, 6], luzhong: [5, 6],
  dabieshan: [3, 7], huaihai: [4, 7], xuzhou: [5, 7],
  wuhan: [3, 8], nanjing: [5, 8], shanghai: [6, 8],
  kunming: [0, 9], guilin: [2, 9], guangzhou: [4, 9],
};
for (const s of E.SPACES) if (!LAYOUT[s.id]) throw new Error("LAYOUT lacks " + s.id);
for (const id of Object.keys(LAYOUT)) if (!E.SPACE[id]) throw new Error("LAYOUT has a space the engine does not: " + id);
export const COLW = 54, ROWH = 52, NODE = 46, X0 = 6, Y0 = 2, ROWS = 10;
export const MAP_H = Y0 * 2 + ROWH * ROWS;
export const centerOf = (id) => [X0 + COLW * LAYOUT[id][0] + COLW / 2, Y0 + ROWH * LAYOUT[id][1] + ROWH / 2];

// ---------- words (to move into the language files when the real page is built) ----------
export const SIDE_ZH = ["共軍", "國軍"];
export const STATE_CH = { sui: "綏", jin: "晉", gui: "桂", ma: "馬", dian: "滇" };
export const USE_ZH = { event: "事件", place: "扶植", campaign: "進攻", lobby: "說客", reform: "變法" };
export const ERA_SHORT = { takeover: "接", turning: "易", decisive: "決" };
export const SIT_TEXT = {
  surrender: "東北的城,雙方都不能放、不能打。",
  truce: "第一次奇襲的一方,民心 2 往對手移。",
  general_offensive: "國軍奇襲 +1。",
  focused_offensive: "國軍奇襲:西北與華東中原 +1,其他地方 −1。",
  counteroffensive: "共軍奇襲鄉 +2;一次扶植可越過相鄰限制。",
  constitution: "國軍每推一格變法軌:民心 1 往國軍,共軍在有藍的城放 1。",
  decisive_battle: "共軍打城不推民生;孤城每回合掉 2。",
  peace_talks: "美國支持 −2;國軍可提和。",
};
export const REASON_ZH = {
  unification: "易幟三方,共軍達成統一",
  alliance: "整編五方,國軍結成聯盟",
  mandate: "民心達到勝利門檻",
  final: "第 8 回合終局記分,民心領先",
  tie: "終局記分,民心打平(平手歸國軍)",
  emperor: "變法軌走到底,登基",
  collapse: "民生崩潰",
  homeFall: "首都失守",
  scoring: "回合結束時手上還有記分牌",
  scoringBoth: "雙方回合結束都留著記分牌",
  inflation: "通膨失控",
};

// ---------- reading a view ----------
export const eraZh = (v) => (E.ERAS.find((e) => e.id === v.era) || {}).zh || v.era;
export const cardOf = (id) => (E.isAid(id) ? E.AID.find((a) => a.id === id) : E.CARD[id]);
export function stateMarks(v, id) {
  const s = E.SPACE[id];
  let m = "";
  if (s.battleground) m += "★";
  if (s.base) m += "根";
  if (s.port) m += "港";
  if ([0, 1].some((side) => E.homeCapital(v, side) === id)) m += "都";
  if (s.state) m += STATE_CH[s.state] + (E.STATES[s.state].capital === id ? "◎" : "");
  return m;
}
export const isolatedSet = (v) => new Set(E.isolatedCities(v));
export const mandateLabel = (m) => (m === 0 ? "平手 0" : m > 0 ? `共 +${m}` : `國 +${-m}`);

// ---------- the top bar ----------
export function topBar(v, { me, extra, line1, chipText }) {
  const sit = E.situationOf(v.turn);
  const turn = h("div", { class: "l1" }, line1 || `第 ${v.turn} 回合 · ${eraZh(v)} · ${sit ? sit.year : ""}`);
  const mine = v.rounds ? v.rounds[me] : null;
  const opp = 1 - me;
  const l2 = h("div", { class: "l2" }, extra || `行動 ${v.round}/${mine} · ${SIDE_ZH[opp]}手牌 ${v.handCounts[opp]} · 牌庫 ${v.drawCount} · 棄牌 ${v.discard.length}`);
  const who = v.winner != null ? null : v.pending ? v.pending.who : v.actor;
  const chip = chipText ? h("div", { class: "chip-turn wait" }, chipText) : who == null ? null : h("div", { class: "chip-turn " + (who === 1 ? "kmt " : "") + (who !== me ? "wait" : "") }, who === me ? `${SIDE_ZH[who]}(你)` : `等${SIDE_ZH[who]}`);
  return h("div", { class: "bar" }, h("div", { class: "l" }, turn, l2), chip, h("button", { class: "menu", "aria-label": "選單", title: "選單" }, "☰"));
}

// ---------- the map ----------
function edgeLayer(v) {
  const svg = h("svg:svg", { class: "edges", width: 390, height: MAP_H, viewBox: `0 0 390 ${MAP_H}` });
  const done = new Set();
  for (const s of E.SPACES) for (const a of s.adj) {
    const key = [s.id, a].sort().join("|");
    if (done.has(key)) continue;
    done.add(key);
    const [x1, y1] = centerOf(s.id), [x2, y2] = centerOf(a);
    const bothCities = s.kind === "city" && E.SPACE[a].kind === "city";
    svg.append(h("svg:line", { x1, y1, x2, y2, stroke: bothCities ? "#22302B" : "#4F6152", "stroke-width": bothCities ? 3 : 1.5, "stroke-dasharray": bothCities ? null : "5 4", "stroke-linecap": "round" }));
  }
  return svg;
}
// opts: targets (Set of ids, dashed frame), chosen (id, solid frame), dimExcept (Set), badges ({id: text}), onTap(id)
export function renderMap(v, opts = {}) {
  const iso = isolatedSet(v);
  const map = h("div", { class: "map", style: { height: MAP_H + "px" } }, edgeLayer(v));
  for (const [text, x, y, vert] of [["東北", 280, 56, false], ["華北", 214, 108, false], ["西北", 10, 218, false], ["華東", 346, 160, true], ["後方", 296, 470, false]])
    map.append(h("div", { class: "region" + (vert ? " v" : ""), style: { left: x + "px", top: y + "px" } }, text));
  for (const s of E.SPACES) {
    const [cx, cy] = centerOf(s.id);
    const [r, b] = E.infOf(v, s.id);
    const ctl = E.controller(v, s.id);
    const classes = ["n", s.kind, ctl === 0 ? "ctl-ccp" : ctl === 1 ? "ctl-kmt" : "ctl-none"];
    const bes = E.besieged(v, s.id), isolated = iso.has(s.id);
    if (isolated) classes.push("iso");
    if (bes) classes.push("bes");
    if (bes && isolated) classes.push("dense"); // two status tabs + the marks: the tabs shrink to fit the 54 px column
    if (opts.targets && opts.targets.has(s.id)) classes.push("target");
    if (opts.chosen === s.id) classes.push("chosen");
    if (opts.rings && opts.rings[s.id]) classes.push("ring-" + opts.rings[s.id]);
    if (opts.dimExcept && !opts.dimExcept.has(s.id)) classes.push("dim");
    const nmClass = s.zh.length >= 4 ? "s4" : s.zh.length === 3 ? "s3" : "";
    const marks = stateMarks(v, s.id);
    const power = s.state && E.STATES[s.state].capital === s.id ? s.state : null;
    const markClass = power ? (v.mie && v.mie[power] ? " mie" : v.seals && v.seals[power] ? " sealed" : "") : "";
    const label = `${s.zh},${s.kind === "city" ? "城" : "鄉"},共軍 ${r} 點,國軍 ${b} 點${ctl === 0 ? ",共軍控制" : ctl === 1 ? ",國軍控制" : ""}${isolated ? ",孤城" : ""}${bes ? ",圍城" : ""}`;
    const node = h(opts.static ? "div" : "button", { class: classes.join(" "), style: { left: cx - NODE / 2 + "px", top: cy - NODE / 2 + "px" }, "data-id": s.id, [opts.static ? "aria-hidden" : "aria-label"]: opts.static ? "true" : label, onclick: opts.onTap ? () => opts.onTap(s.id) : null },
      marks ? h("span", { class: "tab m" + markClass }, marks) : null,
      isolated || bes ? h("span", { class: "tab st" }, isolated ? h("i", { class: "iso" }, "孤") : null, bes ? h("i", { class: "bes" }, "圍") : null) : null,
      h("span", { class: "nm " + nmClass }, s.zh),
      h("span", { class: "pts" }, h("span", { class: "pt " + (r ? "r" : "z") }, r), h("span", { class: "pt " + (b ? "b" : "z") }, b)),
      opts.badges && opts.badges[s.id] ? h("span", { class: "badge" }, opts.badges[s.id]) : null);
    map.append(node);
  }
  return map;
}

// ---------- tracks, in the map's empty north-west corner ----------
export function mandateBar(v) {
  const [toC, toK] = E.mandateWinAt ? E.mandateWinAt(v) : E.MANDATE_WIN;
  const lo = -toK, hi = toC, W = 250, H = 12;
  const x = (m) => ((m - lo) / (hi - lo)) * (W - 2) + 1;
  const earlyC = v.turn < E.MANDATE_FROM[0], earlyK = v.turn < E.MANDATE_FROM[1];
  const m = Math.max(lo, Math.min(hi, v.mandate));
  const svg = h("svg:svg", { width: W, height: H + 8, viewBox: `0 0 ${W} ${H + 8}`, role: "img", "aria-label": `民心 ${mandateLabel(v.mandate)}` },
    h("svg:rect", { x: 0, y: 4, width: x(0), height: H, fill: "#DCE6F2" }),
    h("svg:rect", { x: x(0), y: 4, width: W - x(0), height: H, fill: "#F3DEDB" }),
    // before the first turn each side may win on the mandate, the track is capped (MANDATE_CAP): hatch what is closed
    earlyK ? h("svg:rect", { x: 0, y: 4, width: x(-E.MANDATE_CAP[1]), height: H, fill: "url(#cap)" }) : null,
    earlyC ? h("svg:rect", { x: x(E.MANDATE_CAP[0] + 1), y: 4, width: W - x(E.MANDATE_CAP[0] + 1), height: H, fill: "url(#cap)" }) : null,
    h("svg:rect", { x: 0.5, y: 4.5, width: W - 1, height: H - 1, fill: "none", stroke: "#22302B", "stroke-width": 1 }),
    h("svg:line", { x1: x(0), y1: 2, x2: x(0), y2: H + 6, stroke: "#22302B", "stroke-width": 2 }),
    h("svg:path", { d: `M ${x(m)} 1 l -5 -1 l 10 0 z M ${x(m)} 4 L ${x(m)} ${H + 4}`, stroke: "#22302B", "stroke-width": 3, fill: "#22302B" }),
    h("svg:circle", { cx: x(m), cy: 4 + H / 2, r: 5, fill: v.mandate > 0 ? "#A3241B" : v.mandate < 0 ? "#1D4E89" : "#22302B", stroke: "#fff", "stroke-width": 1.5 }));
  const defs = h("svg:defs", {}, h("svg:pattern", { id: "cap", width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, h("svg:rect", { width: 5, height: 5, fill: "#fff", opacity: .5 }), h("svg:line", { x1: 0, y1: 0, x2: 0, y2: 5, stroke: "#22302B", "stroke-width": 1.5 })));
  svg.prepend(defs);
  return h("div", { class: "trk mand" },
    h("div", { class: "top" }, h("b", {}, "民心"), h("span", { class: "val " + (v.mandate > 0 ? "r" : v.mandate < 0 ? "b" : "") }, mandateLabel(v.mandate))),
    svg,
    h("div", { class: "ends" }, h("span", {}, `國勝 −${toK}${earlyK ? `(第 ${E.MANDATE_FROM[1]} 回合起)` : ""}`), h("span", {}, `共勝 +${toC}${earlyC ? `(第 ${E.MANDATE_FROM[0]} 回合起)` : ""}`)));
}
export function pips(n, total, cls = "") { return h("span", { class: "pips", "aria-hidden": "true" }, Array.from({ length: total }, (_, i) => h("span", { class: "pip" + (i < n ? " on " + cls : "") }))); }
export function trackPanel(v) {
  const wk = v.weariness;
  return h("div", { class: "corner", style: { left: "10px", top: Y0 + 2 + "px", width: "262px", display: "flex", flexDirection: "column", gap: "3px" } },
    mandateBar(v),
    h("div", { class: "trk" }, h("b", {}, "民生"), pips(wk, 5), h("span", {}, `${E.WEARINESS_NAMES[wk]}`), h("b", { style: { marginLeft: "auto" } }, "支持"), h("span", { class: "r" }, `蘇${v.support[0]}`), h("span", { class: "b" }, `美${v.support[1]}`)),
    h("div", { class: "trk" }, h("b", {}, "建軍"), pips(v.reform[0], 6, "r"), h("b", { style: { marginLeft: "auto" } }, "行憲"), pips(v.reform[1], 6, "b")));
}
// 時局 and the five regional powers (易幟 / 整編 count), in the south-west corner
export function cornerSouthWest(v, { prefix = "時局" } = {}) {
  const sit = E.situationOf(v.turn);
  const mie = Object.keys(v.mie || {}).length, seals = Object.keys(v.seals || {}).length;
  return h("div", { class: "corner", style: { left: "10px", top: Y0 + ROWH * 7 + 2 + "px", width: "162px", display: "flex", flexDirection: "column", gap: "3px" } },
    h("div", { class: "sit" }, h("div", { class: "t" }, `${prefix} · ${sit.zh}`), h("div", { class: "d" }, SIT_TEXT[sit.id])),
    h("div", { class: "trk", style: { gap: "2px" } }, Object.keys(E.STATES).map((p) => h("span", { class: "tok" + (v.mie && v.mie[p] ? " mie" : v.seals && v.seals[p] ? " sealed" : ""), title: E.STATES[p].zh }, STATE_CH[p])),
      h("span", { style: { marginLeft: "3px", fontSize: "11px", lineHeight: "12px" } }, h("span", { class: "r" }, `易${mie}/${v.options.mie}`), " ", h("span", { class: "b" }, `整${seals}/${v.options.seals}`))));
}

// ---------- a card in the hand ----------
export function cardChip(id, { sel, onTap, side, disabled, label } = {}) {
  const c = cardOf(id);
  const aid = E.isAid(id);
  const ops = aid ? label : c.ops;
  const s = aid ? E.AID.findIndex((a) => a.id === id) : c.side;
  return h("button", { class: `cd s${s == null ? "n" : s}` + (sel ? " sel" : "") + (aid ? " aid" : ""), "data-card": id, "aria-pressed": sel ? "true" : "false", disabled: disabled || null, onclick: onTap, "aria-label": `${c.zh},${ops} 點` },
    h("span", { class: "top" }, h("span", { class: "ops" }, ops), aid ? h("span", { class: "era" }, "外援") : h("span", { class: "era" }, ERA_SHORT[c.era] || "")),
    h("span", { class: "nm" }, c.zh));
}

// ---------- reading the log (it is the one place a turn's story is kept) ----------
export const LEVEL_ZH = { none: "無", presence: "臨在", domination: "優勢", control: "控制" };
// Every 民心 change in the log, in order: { t, side, n (signed toward the Communists), before, after, clamped }.
export function mandateSteps(v) {
  const out = [];
  let m = 0;
  v.log.forEach((e, k) => {
    if (e.type !== "vp") return;
    const signed = e.side === 0 ? e.n : -e.n;
    out.push({ t: e.t, i: e.i, k, signed, before: m, after: e.mandate, clamped: e.mandate - m !== signed });
    m = e.mandate;
  });
  return out;
}
// 民心 at the end of each turn 1..N (and 0 at the start), carried forward over turns where it did not move.
export function mandateCurve(v) {
  const last = Math.max(...v.log.map((e) => e.t));
  const pts = [{ t: 0, m: 0 }];
  let m = 0;
  for (let t = 1; t <= last; t++) {
    for (const e of v.log) if (e.t === t && e.type === "vp") m = e.mandate;
    pts.push({ t, m });
  }
  return pts;
}
export const logOf = (v, t, type) => v.log.filter((e) => e.t === t && e.type === type);
