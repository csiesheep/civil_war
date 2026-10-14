// public/app.js -- the game page (#44): a game against the bot, on a phone. Layout from the approved mockup (design/m3).
// The page draws what play.js gives it (view, choices) and sends taps back; it holds no rule. Every visible string is in
// i18n/zh-Hant.js (`t`). Saves to localStorage after every tap (every read and write in try/catch: no storage = no resume,
// never a blank page). The bot thinks in a Web Worker (botworker.js); each of its moves is shown before the next.
import T, { t } from "./i18n/zh-Hant.js";
import * as E from "./shared/engine.js";
import { createSession, restoreSession, decideTask } from "./play.js";

const KEY = "civil_war.save.v1";
const NODE = 46;
const STEP_MS = 900;        // how long a bot move stays on screen before the next one
const QUICK_MS = 250;       // ... when it changed nothing worth reading
const app = document.getElementById("app");

// ---------- state of the page ----------
const S = { sess: null, ack: 1, thinking: false, driving: false, sheet: null, focus: null, toast: null, saveOk: true, review: false, stretchFrom: 0 };

// ---------- a six-line stand-in for a framework ----------
const SVGNS = "http://www.w3.org/2000/svg";
function h(tag, props, ...kids) {
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

// ---------- reading the engine's data (names, marks) ----------
const cardOf = (id) => (E.isAid(id) ? E.AID.find((a) => a.id === id) : E.CARD[id]);
const spaceZh = (id) => (E.SPACE[id] ? E.SPACE[id].zh : id);
const eraZh = (v) => (E.ERAS.find((e) => e.id === v.era) || {}).zh || v.era || "";
const mandateLabel = (m) => (m === 0 ? t("hud.even") : m > 0 ? t("hud.ccpAhead", { n: m }) : t("hud.kmtAhead", { n: -m }));
function stateMarks(v, id) {
  const s = E.SPACE[id];
  let m = "";
  if (s.battleground) m += "★";
  if (s.base) m += T.mark.base;
  if (s.port) m += T.mark.port;
  if ([0, 1].some((side) => E.homeCapital(v, side) === id)) m += T.mark.capital;
  if (s.state) m += T.stateCh[s.state] + (E.STATES[s.state].capital === id ? "◎" : "");
  return m;
}

// ---------- the map ----------
const LAYOUT = {
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
const COLW = 54, ROWH = 52, X0 = 6, Y0 = 2, ROWS = 10;
const MAP_H = Y0 * 2 + ROWH * ROWS;
const centerOf = (id) => [X0 + COLW * LAYOUT[id][0] + COLW / 2, Y0 + ROWH * LAYOUT[id][1] + ROWH / 2];

function edgeLayer() {
  const svg = h("svg:svg", { class: "edges", width: 390, height: MAP_H, viewBox: `0 0 390 ${MAP_H}` });
  const done = new Set();
  for (const s of E.SPACES) for (const a of s.adj) {
    const key = [s.id, a].sort().join("|");
    if (done.has(key)) continue;
    done.add(key);
    const [x1, y1] = centerOf(s.id), [x2, y2] = centerOf(a);
    const both = s.kind === "city" && E.SPACE[a].kind === "city";
    svg.append(h("svg:line", { x1, y1, x2, y2, stroke: both ? "#22302B" : "#4F6152", "stroke-width": both ? 3 : 1.5, "stroke-dasharray": both ? null : "5 4", "stroke-linecap": "round" }));
  }
  return svg;
}
// opts: targets (Set: tappable, gold frame), chosen (Set: thick frame), rings {id: kind}, changes {id: [dr, db]}, counts {id: n}, onTap(id), static
function renderMap(v, opts = {}) {
  const iso = new Set(E.isolatedCities(v));
  const map = h("div", { class: "map", style: { height: MAP_H + "px" } }, edgeLayer());
  const regions = T.mapRegions;
  for (const r of regions) map.append(h("div", { class: "region" + (r.v ? " v" : ""), style: { left: r.x + "px", top: r.y + "px" } }, r.zh));
  for (const s of E.SPACES) {
    const [cx, cy] = centerOf(s.id);
    const [r, b] = E.infOf(v, s.id);
    const ctl = E.controller(v, s.id);
    const classes = ["n", s.kind, ctl === 0 ? "ctl-ccp" : ctl === 1 ? "ctl-kmt" : "ctl-none"];
    const bes = E.besieged(v, s.id), isolated = iso.has(s.id);
    if (isolated) classes.push("iso");
    if (bes) classes.push("bes");
    if (bes && isolated) classes.push("dense");
    if (opts.targets && opts.targets.has(s.id)) classes.push("target");
    if (opts.chosen && opts.chosen.has(s.id)) classes.push("chosen");
    if (opts.rings && opts.rings[s.id]) classes.push("ring-" + opts.rings[s.id]);
    const ch = opts.changes && opts.changes[s.id];
    if (ch) classes.push("chg");
    const nm = s.zh.length >= 4 ? "s4" : s.zh.length === 3 ? "s3" : "";
    const marks = stateMarks(v, s.id);
    const power = s.state && E.STATES[s.state].capital === s.id ? s.state : null;
    const markClass = power ? (v.mie && v.mie[power] ? " mie" : v.seals && v.seals[power] ? " sealed" : "") : "";
    const label = t("a11y.node", {
      name: s.zh, kind: t(s.kind === "city" ? "legend.city" : "legend.village"), r, b,
      ctl: ctl === 0 ? t("a11y.ctlCcp") : ctl === 1 ? t("a11y.ctlKmt") : "", iso: isolated ? t("a11y.iso") : "", bes: bes ? t("a11y.bes") : "",
    });
    const dl = ch ? h("span", { class: "dl" }, ch[0] ? h("i", { class: "r" }, (ch[0] > 0 ? "+" : "−") + Math.abs(ch[0])) : null, ch[1] ? h("i", { class: "b" }, (ch[1] > 0 ? "+" : "−") + Math.abs(ch[1])) : null) : null;
    const cnt = opts.counts && opts.counts[s.id] ? h("span", { class: "cnt" }, "+" + opts.counts[s.id]) : null;
    const node = h(opts.static ? "div" : "button", {
      class: classes.join(" "), style: { left: cx - NODE / 2 + "px", top: cy - NODE / 2 + "px" }, "data-id": s.id,
      [opts.static ? "aria-hidden" : "aria-label"]: opts.static ? "true" : label, onclick: opts.onTap ? () => opts.onTap(s.id) : null,
    },
    marks ? h("span", { class: "tab m" + markClass }, marks) : null,
    isolated || bes ? h("span", { class: "tab st" }, isolated ? h("i", { class: "iso" }, T.mark.iso) : null, bes ? h("i", { class: "bes" }, T.mark.bes) : null) : null,
    h("span", { class: "nm " + nm }, s.zh),
    h("span", { class: "pts" }, h("span", { class: "pt " + (r ? "r" : "z") }, r), h("span", { class: "pt " + (b ? "b" : "z") }, b)),
    dl, cnt);
    map.append(node);
  }
  return map;
}

// ---------- tracks in the map's empty corners ----------
function mandateBar(v) {
  const [toC, toK] = E.mandateWinAt ? E.mandateWinAt(v) : E.MANDATE_WIN;
  const lo = -toK, hi = toC, W = 250, H = 12;
  const x = (m) => ((m - lo) / (hi - lo)) * (W - 2) + 1;
  const earlyC = v.turn < E.MANDATE_FROM[0], earlyK = v.turn < E.MANDATE_FROM[1];
  const m = Math.max(lo, Math.min(hi, v.mandate));
  const svg = h("svg:svg", { width: W, height: H + 8, viewBox: `0 0 ${W} ${H + 8}`, role: "img", "aria-label": `${t("hud.mandate")} ${mandateLabel(v.mandate)}` },
    h("svg:defs", {}, h("svg:pattern", { id: "cap", width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, h("svg:rect", { width: 5, height: 5, fill: "#fff", opacity: 0.5 }), h("svg:line", { x1: 0, y1: 0, x2: 0, y2: 5, stroke: "#22302B", "stroke-width": 1.5 }))),
    h("svg:rect", { x: 0, y: 4, width: x(0), height: H, fill: "#DCE6F2" }),
    h("svg:rect", { x: x(0), y: 4, width: W - x(0), height: H, fill: "#F3DEDB" }),
    earlyK ? h("svg:rect", { x: 0, y: 4, width: x(-E.MANDATE_CAP[1]), height: H, fill: "url(#cap)" }) : null,
    earlyC ? h("svg:rect", { x: x(E.MANDATE_CAP[0] + 1), y: 4, width: W - x(E.MANDATE_CAP[0] + 1), height: H, fill: "url(#cap)" }) : null,
    h("svg:rect", { x: 0.5, y: 4.5, width: W - 1, height: H - 1, fill: "none", stroke: "#22302B", "stroke-width": 1 }),
    h("svg:line", { x1: x(0), y1: 2, x2: x(0), y2: H + 6, stroke: "#22302B", "stroke-width": 2 }),
    h("svg:circle", { cx: x(m), cy: 4 + H / 2, r: 5, fill: v.mandate > 0 ? "#A3241B" : v.mandate < 0 ? "#1D4E89" : "#22302B", stroke: "#fff", "stroke-width": 1.5 }));
  return h("div", { class: "trk mand" },
    h("div", { class: "top" }, h("b", {}, t("hud.mandate")), h("span", { class: "val " + (v.mandate > 0 ? "r" : v.mandate < 0 ? "b" : "") }, mandateLabel(v.mandate))),
    svg,
    h("div", { class: "ends" }, h("span", {}, t("hud.kmtWins", { n: toK }) + (earlyK ? t("hud.fromTurn", { n: E.MANDATE_FROM[1] }) : "")), h("span", {}, t("hud.ccpWins", { n: toC }) + (earlyC ? t("hud.fromTurn", { n: E.MANDATE_FROM[0] }) : ""))));
}
const pips = (n, total, cls = "") => h("span", { class: "pips", "aria-hidden": "true" }, Array.from({ length: total }, (_, i) => h("span", { class: "pip" + (i < n ? " on " + cls : "") })));
function trackPanel(v) {
  return h("div", { class: "corner", style: { left: "10px", top: Y0 + 2 + "px", width: "262px", display: "flex", flexDirection: "column", gap: "3px" } },
    mandateBar(v),
    h("div", { class: "trk" }, h("b", {}, t("hud.weariness")), pips(v.weariness, 5), h("span", {}, E.WEARINESS_NAMES[v.weariness]), h("b", { style: { marginLeft: "auto" } }, t("hud.support")), h("span", { class: "r" }, t("hud.supportSoviet", { n: v.support[0] })), h("span", { class: "b" }, t("hud.supportUs", { n: v.support[1] }))),
    h("div", { class: "trk" }, h("b", {}, t("hud.reformCcp")), pips(v.reform[0], 6, "r"), h("b", { style: { marginLeft: "auto" } }, t("hud.reformKmt")), pips(v.reform[1], 6, "b")));
}
function cornerSouthWest(v, prefix) {
  const sit = E.situationOf(Math.max(1, v.turn));
  const mie = Object.keys(v.mie || {}).length, seals = Object.keys(v.seals || {}).length;
  return h("div", { class: "corner", style: { left: "10px", top: Y0 + ROWH * 7 + 2 + "px", width: "162px", display: "flex", flexDirection: "column", gap: "3px" } },
    h("div", { class: "sit" }, h("div", { class: "t" }, `${prefix || t("hud.situation")} · ${sit.zh}`), h("div", { class: "d" }, t("sit." + sit.id))),
    h("div", { class: "trk", style: { gap: "2px" } }, Object.keys(E.STATES).map((p) => h("span", { class: "tok" + (v.mie && v.mie[p] ? " mie" : v.seals && v.seals[p] ? " sealed" : ""), title: E.STATES[p].zh }, T.stateCh[p])),
      h("span", { style: { marginLeft: "3px", fontSize: "11px", lineHeight: "12px" } }, h("span", { class: "r" }, t("hud.mie", { n: mie, of: v.options.mie })), " ", h("span", { class: "b" }, t("hud.seal", { n: seals, of: v.options.seals })))));
}
function mapBlock(v, opts) {
  const map = renderMap(v, opts);
  map.append(trackPanel(v), cornerSouthWest(v, opts && opts.prefix));
  return h("div", { class: "mapwrap" }, map);
}

// ---------- the top bar ----------
function topBar(v, sess, extra) {
  const me = sess.side;
  const sit = E.situationOf(Math.max(1, v.turn));
  const over = sess.over();
  const l1 = (extra && extra.line1) || `${t("hud.turn", { n: Math.max(1, v.turn) })} · ${eraZh(v) || T.eraSetup} · ${sit ? sit.year : ""}`;
  const l2 = (extra && extra.line2) || [
    v.phase === "action" ? t("hud.round", { r: v.round, of: v.rounds ? v.rounds[me] : "" }) : t("hud.phase." + v.phase),
    t("hud.oppHand", { side: T.side[1 - me], n: v.handCounts[1 - me] }), t("hud.draw", { n: v.drawCount }), t("hud.discard", { n: v.discard.length }),
  ].join(" · ");
  const turn = sess.turnOf();
  let chip = null;
  if (extra && extra.chip) chip = h("div", { class: "chip-turn wait" }, extra.chip);
  else if (!over) {
    const who = turn === "human" ? me : 1 - me;
    chip = h("div", { class: "chip-turn " + (who === 1 ? "kmt " : "") + (turn !== "human" ? "wait" : "") }, turn === "human" ? t("hud.you", { side: T.side[me] }) : t("hud.waitFor", { side: T.side[who] }));
  }
  return h("div", { class: "bar" }, h("div", { class: "l" }, h("div", { class: "l1" }, l1), h("div", { class: "l2" }, l2)), chip,
    h("button", { class: "menu", "aria-label": t("page.menu"), title: t("page.menu"), onclick: () => { S.sheet = "menu"; render(); } }, "☰"));
}

// ---------- a card in the hand ----------
function cardChip(id, { sel, onTap, disabled, ops }) {
  const c = cardOf(id), aid = E.isAid(id);
  const s = aid ? E.AID.findIndex((a) => a.id === id) : c.side;
  const o = aid ? ops : c.ops;
  return h("button", { class: `cd s${s == null ? "n" : s}` + (sel ? " sel" : "") + (aid ? " aid" : ""), "data-card": id, "aria-pressed": sel ? "true" : "false", disabled: disabled || null, onclick: onTap, "aria-label": t("a11y.card", { name: c.zh, ops: o }) },
    h("span", { class: "top" }, h("span", { class: "ops" }, o), h("span", { class: "era" }, aid ? t("panel.aidShort") : T.eraShort[c.era] || "")),
    h("span", { class: "nm" }, c.zh));
}

// ---------- reading the log: what a move did ----------
const sideName = (s) => T.side[s];
const groupPoints = (list) => {
  const m = new Map();
  for (const id of list || []) m.set(id, (m.get(id) || 0) + 1);
  return [...m].map(([id, n]) => (n > 1 ? `${spaceZh(id)}×${n}` : spaceZh(id))).join("、");
};
const infText = (list) => list.map(([id, dr, db]) => `${spaceZh(id)} ${dr ? t("log.red", { n: (dr > 0 ? "+" : "−") + Math.abs(dr) }) : ""}${dr && db ? " " : ""}${db ? t("log.blue", { n: (db > 0 ? "+" : "−") + Math.abs(db) }) : ""}`).join("、");
function entryText(e) {
  const cn = (id) => (id ? (cardOf(id) ? cardOf(id).zh : id) : "?");
  switch (e.type) {
    case "play": {
      const use = t("useVerb." + e.use);
      if (e.pair) return t("feed.playedPair", { side: sideName(e.side), card: cn(e.card), pair: cn(e.pair), use });
      if (E.isAid(e.card)) return t("feed.playedAid", { side: sideName(e.side), card: cn(e.card), use });
      return t(e.use === "event" ? "feed.playedEvent" : "feed.playedUse", { side: sideName(e.side), card: cn(e.card), use });
    }
    case "place": return t("log.place", { side: sideName(e.side), points: groupPoints(e.points) });
    case "campaign": return t("log.campaign", { side: sideName(e.side), target: spaceZh(e.target), ops: e.ops, removed: e.removed ?? 0, placed: e.placed ?? 0 });
    case "siege": return t("log.siege", { side: sideName(e.side), target: spaceZh(e.target), ops: e.ops });
    case "sweep": return t("log.sweep", { side: sideName(e.side), target: spaceZh(e.target), ops: e.ops });
    case "siegeResult": {
      const parts = [];
      if (e.removed) parts.push(t("log.removedBlue", { n: e.removed }));
      if (e.placed) parts.push(t("log.placedRed", { n: e.placed }));
      if (e.moved) parts.push(t("log.movedTo", { to: spaceZh(e.to), n: e.moved }));
      if (e.besieged) parts.push(t("log.besieged"));
      const resp = e.response === "hold" ? t("log.siegeNote.hold") : e.response === "reinforce" ? t("log.reinforce", { from: spaceZh(e.to), k: e.k }) : t("log.breakout", { to: spaceZh(e.to) });
      return t("log.siegeResult", { target: spaceZh(e.target), plan: t("log.siegeNote." + e.plan), response: resp, result: parts.join("、") || t("log.nothing") });
    }
    case "sweepResult": {
      const parts = [];
      if (e.removed) parts.push(t("log.removedRed", { n: e.removed }));
      if (e.placed) parts.push(t("log.placedBlue", { n: e.placed }));
      if (e.response === "withdraw") parts.push(t("log.withdrew", { n: e.moved || 0 }));
      return t("log.sweepResult", { target: spaceZh(e.target), response: t("opt.sweep." + e.response), result: parts.join("、") || t("log.nothing") });
    }
    case "siegeLoss": return t("log.siegeLoss", { space: spaceZh(e.space), n: -e.n });
    case "siegeCapture": return t("log.siegeCapture", { space: spaceZh(e.space), n: e.n });
    case "lobby": return t("log.lobby", { side: sideName(e.side), target: spaceZh(e.target), removed: e.removed ?? 0 });
    case "realign": return t("log.realign", { side: sideName(e.side), target: spaceZh(e.target), n: e.n });
    case "eventEnd": return e.effect ? t("log.eventDid", { card: cn(e.card) }) : t("log.eventNone", { card: cn(e.card) });
    case "setup": return t("log.setup", { side: sideName(e.side), points: groupPoints(e.points) });
    case "reform": return t("log.reform", { side: sideName(e.side), box: e.box });
    case "headline": return t("feed.headlines", { ccp: cn(e.cards[0]), kmt: cn(e.cards[1]) });
    case "discard": return t("log.discard", { side: sideName(e.side), card: cn(e.card) });
    case "bog": return t("log.bog", { side: sideName(e.side), card: cn(e.card) });
    case "opsLost": return t("log.opsLost", { side: sideName(e.side) });
    case "skip": return t("log.skip", { side: sideName(e.side) });
    case "vp": return t("log.vp", { side: sideName(e.side), n: e.n, mandate: mandateLabel(e.mandate) });
    case "tire": return t("log.tire", { to: e.to, name: E.WEARINESS_NAMES[e.to] });
    case "truceBroken": return t("log.truceBroken", { side: sideName(e.side) });
    case "mie": return t("log.mie", { state: E.STATES[e.state] ? E.STATES[e.state].zh : e.state });
    case "seal": return t("log.seal", { state: E.STATES[e.state] ? E.STATES[e.state].zh : e.state });
    case "withdrawal": return t("log.withdrawal", { side: sideName(e.side) });
    default: return null;
  }
}
// One move as lines: the entries worth saying, then the board change.
function moveLines(rec) {
  const lines = rec.entries.map(entryText).filter(Boolean);
  if (rec.changes.length) lines.push(t("feed.changes") + ":" + infText(rec.changes));
  return lines;
}
// The board changes of the moves the opponent made since the human last acted, summed per space.
function stretchChanges(sess) {
  const sum = {};
  for (const m of sess.recent()) for (const [id, dr, db] of m.changes) { const a = (sum[id] ||= [0, 0]); a[0] += dr; a[1] += db; }
  for (const k of Object.keys(sum)) if (!sum[k][0] && !sum[k][1]) delete sum[k];
  return sum;
}

// ---------- the footer ----------
function useButtons(sess, cs) {
  const by = (id) => cs.find((c) => c.id === id);
  const order = ["event", "place", "campaign", "lobby", "reform"];
  const out = order.map((u) => {
    const c = by(`use:${u}`);
    return h("button", { class: "btn fl" + (c && c.selected ? " on" : ""), disabled: !c || null, "aria-pressed": c && c.selected ? "true" : "false", onclick: c ? () => tap(c.id) : null }, t("use." + u));
  });
  return out;
}
const confirmBtn = (cs, sess) => {
  const c = cs.find((x) => x.id === "confirm");
  return h("button", { class: "btn go fl" + (sess.side === 1 ? " kmt" : ""), style: { flex: "0 0 auto", minWidth: "76px" }, disabled: !c || null, onclick: c ? () => tap("confirm") : null }, t("c.confirm"));
};
const cancelBtn = (cs) => {
  const c = cs.find((x) => x.id === "cancel");
  return c ? h("button", { class: "btn", "aria-label": t("c.cancel"), onclick: () => tap("cancel") }, "✕") : null;
};

// the targets of a campaign / lobby, or the points of a 扶植, as the panel's context row
function opsContext(sess, cs, eu) {
  const nodes = [];
  if (eu === "place") {
    const b = sess.builder();
    const pts = b ? b.points : [];
    const counts = {};
    for (const id of pts) counts[id] = (counts[id] || 0) + 1;
    const focus = S.focus && (counts[S.focus] || cs.some((c) => c.id === `pt+:${S.focus}`)) ? S.focus : pts.length ? pts[pts.length - 1] : null;
    const plus = focus && cs.find((c) => c.id === `pt+:${focus}`), minus = focus && cs.find((c) => c.id === `pt-:${focus}`);
    nodes.push(h("div", { class: "row" },
      h("div", { class: "stepper" },
        h("button", { class: "btn sq", "aria-label": t("c.minusPoint", { space: focus ? spaceZh(focus) : "" }), disabled: !minus || null, onclick: minus ? () => tap(minus.id) : null }, "−"),
        h("div", { class: "nm" }, focus ? spaceZh(focus) : t("panel.tapMap"), h("small", {}, focus ? t("panel.pointsAt", { n: counts[focus] || 0, cost: plus ? t("panel.costEach", { n: plus.cost }) : "" }) : (b ? t("panel.pointsLeft", { n: b.left }) : ""))),
        h("button", { class: "btn sq", "aria-label": t("c.plusPoint", { space: focus ? spaceZh(focus) : "" }), disabled: !plus || null, onclick: plus ? () => tap(plus.id) : null }, "+")),
      confirmBtn(cs, sess)));
    return nodes;
  }
  const tg = cs.filter((c) => c.kind === "target");
  const sel = tg.find((c) => c.selected);
  const plans = cs.filter((c) => c.kind === "plan");
  nodes.push(h("div", { class: "row" },
    h("div", { class: "btn", style: { minWidth: "84px", flex: plans.length ? "0 0 auto" : "1" } }, sel ? spaceZh(sel.space) : t("panel.tapMap"), h("small", {}, sel ? t(eu === "lobby" ? "panel.lobbying" : "panel.attacking") : t("panel.pickTarget"))),
    plans.map((p) => h("button", { class: "btn fl" + (p.selected ? " on" : ""), "aria-pressed": p.selected ? "true" : "false", onclick: () => tap(p.id) }, p.label, h("small", {}, t("panel.planHint." + p.plan)))),
    confirmBtn(cs, sess)));
  return nodes;
}

function actionPanel(sess, cs, v) {
  const d = sess.draft;
  if (!d.card) return null;
  const c = cardOf(d.card), aid = E.isAid(d.card);
  const m = sess.mode();
  const entry = !aid && m.legal.cards ? m.legal.cards.find((x) => x.id === d.card) : null;
  const meta = aid ? t("panel.aidMeta", { ops: E.opsOf(v, sess.side, d.card) }) : t("panel.cardMeta", { side: c.side == null ? t("panel.cardNeutral") : T.side[c.side], ops: c.ops, year: c.year });
  const head = h("div", { class: "hd" }, h("span", { class: "nm" }, c.zh), h("span", { class: "meta" }, meta));
  const kids = [head];
  const eu = d.use === "pair" ? d.puse : d.use;
  const wrap = () => h("div", { class: "panel", "aria-label": t("panel.actionLabel") }, kids);
  if (cs.some((x) => x.id === "use:bog")) {
    kids.push(h("div", { class: "note" }, t("panel.bogHint")));
    kids.push(h("div", { class: "row" }, h("button", { class: "btn fl" + (d.use === "bog" ? " on" : ""), onclick: () => tap("use:bog") }, t("use.bog")), confirmBtn(cs, sess), cancelBtn(cs)));
    return wrap();
  }
  const building = (eu === "place" && (d.use !== "pair" || d.pair)) ? sess.builder() : null;
  // the card's text, or, while points are being picked, what has been picked
  kids.push(building && building.points.length ? h("div", { class: "tx" }, t("panel.picked", { list: groupPoints(building.points), n: building.left })) : aid ? null : h("div", { class: "tx" }, c.text));
  kids.push(h("div", { class: "row" }, useButtons(sess, cs), cs.some((x) => x.id === "use:pair") ? h("button", { class: "btn fl" + (d.use === "pair" ? " on" : ""), onclick: () => tap("use:pair") }, t("use.pairShort")) : null, cancelBtn(cs)));
  const note = (key, withConfirm) => kids.push(h("div", { class: "row" }, h("div", { class: "note", style: { flex: 1, alignSelf: "center" } }, t(key, { card: c.zh })), withConfirm ? confirmBtn(cs, sess) : null));
  if (!d.use) note("panel.pickUse", false);
  else if (d.use === "reform") note("panel.reformNote", true);
  else if (d.use === "event") note(entry && entry.uses.enemy ? "panel.eventEnemy" : "panel.eventOwn", true);
  else if (d.use === "pair") {
    kids.push(h("div", { class: "chips" }, cs.filter((x) => x.kind === "pair").map((p) => h("button", { class: "chip" + (p.selected ? " on" : ""), onclick: () => tap(p.id) }, p.label))));
    if (d.pair) kids.push(h("div", { class: "row" }, cs.filter((x) => x.id.startsWith("puse:")).map((u) => h("button", { class: "btn fl" + (u.selected ? " on" : ""), onclick: () => tap(u.id) }, u.label))));
    else kids.push(h("div", { class: "note" }, t("panel.pickPair")));
    if (d.pair && d.puse) kids.push(...opsContext(sess, cs, eu));
  } else {
    const orders = cs.filter((x) => x.kind === "order");
    if (orders.length) kids.push(h("div", { class: "row" }, orders.map((o) => h("button", { class: "btn fl" + (o.selected ? " on" : ""), "aria-pressed": o.selected ? "true" : "false", onclick: () => tap(o.id) }, o.label))));
    if (orders.length && !d.order) kids.push(h("div", { class: "note" }, t("panel.pickOrder")));
    else if (d.order === "eventFirst") note("panel.eventFirstNote", true);
    else kids.push(...opsContext(sess, cs, eu));
  }
  return wrap();
}

function handBlock(sess, cs, v) {
  const me = sess.side, hand = v.hands[me] || [];
  const can = (id) => cs.find((c) => c.id === `card:${id}`);
  const cards = hand.map((id) => cardChip(id, { sel: sess.draft.card === id && !sess.draft.aid, disabled: !can(id), onTap: can(id) ? () => tap(`card:${id}`) : null }));
  const aid = cs.find((c) => c.aid);
  if (aid) {
    const ops = (E.opsOf ? E.opsOf(v, me, aid.card) : 0);
    cards.push(cardChip(aid.card, { sel: !!sess.draft.aid, ops, onTap: () => tap(aid.id) }));
  }
  return h("div", { class: "hand" }, cards);
}

function feedLine(sess) {
  const rec = sess.recent();
  const me = sess.side;
  const last = rec.length ? rec[rec.length - 1] : null;
  if (S.thinking) {
    return h("button", { class: "feedline thinking", onclick: () => { S.sheet = "feed"; render(); } }, h("span", { class: "tag" }, T.side[1 - me]), h("span", { class: "tx" }, last ? firstLine(last) : t("page.thinking"), " ", h("span", { class: "dots" })));
  }
  if (!last) return h("div", { class: "note" }, t("feed.none"));
  return h("button", { class: "feedline", onclick: () => { S.sheet = "feed"; render(); } }, h("span", { class: "tag" + (me === 0 ? " b" : " r") }, t("feed.title")), h("span", { class: "tx" }, rec.map(firstLine).join(" ▸ ")));
}
const firstLine = (rec) => {
  const lines = rec.entries.map(entryText).filter(Boolean);
  const main = lines.find((l) => l) || "";
  return main + (rec.changes.length ? "(" + infText(rec.changes) + ")" : "");
};

function pendingPanel(sess, cs, v) {
  const m = sess.mode(), p = m.pending, d = sess.draft;
  const title = t("pending." + (p.tag || "generic"), { target: p.target ? spaceZh(p.target) : "", ops: p.ops, n: p.n ?? p.min ?? 0 });
  const titleText = title.startsWith("pending.") ? t("pending.generic") : title;
  const kids = [h("div", { class: "hd" }, h("span", { class: "nm" }, titleText), p.card && cardOf(p.card) ? h("span", { class: "meta" }, cardOf(p.card).zh) : null)];
  if (p.kind === "option") {
    kids.push(h("div", { class: "grid2" }, cs.filter((c) => c.kind === "option").map((c) => h("button", { class: "btn opt" + (c.selected ? " on" : "") + (sess.side === 1 ? " kmtsel" : ""), "aria-pressed": c.selected ? "true" : "false", onclick: () => tap(c.id) }, c.label))));
    const sel = cs.find((c) => c.kind === "option" && c.selected);
    if (p.tag === "siege") kids.push(h("div", { class: "rules" }, siegeRules(sel ? sel.option.split(":")[0] : null)));
    if (p.tag === "sweep") kids.push(h("div", { class: "rules" }, t("rules.sweep")));
  } else if (p.kind === "card") {
    kids.push(h("div", { class: "note" }, t("panel.pickCards", { min: p.min ?? 1, max: p.n ?? 1 })));
    kids.push(h("div", { class: "chips" }, cs.filter((c) => c.kind === "pick").map((c) => h("button", { class: "chip" + (c.selected ? " on" : ""), "aria-pressed": c.selected ? "true" : "false", onclick: () => tap(c.id) }, c.label))));
  } else if (p.kind === "points") {
    const pts = d.points || [];
    const counts = {};
    for (const id of pts) counts[id] = (counts[id] || 0) + 1;
    kids.push(h("div", { class: "note" }, t("panel.pickN", { n: p.n ?? p.min ?? 0, have: pts.length })));
    kids.push(h("div", { class: "chips" }, Object.keys(counts).map((id) => h("button", { class: "chip on", onclick: () => { const c = cs.find((x) => x.id === `pt-:${id}`); if (c) tap(c.id); } }, `${spaceZh(id)}${counts[id] > 1 ? "×" + counts[id] : ""} ✕`))));
  } else if (p.kind === "ops") {
    kids.push(h("div", { class: "row" }, cs.filter((c) => c.kind === "use").map((c) => h("button", { class: "btn fl" + (c.selected ? " on" : ""), onclick: () => tap(c.id) }, c.label)), cancelBtn(cs)));
    if (d.use) kids.push(...opsContext(sess, cs, d.use)); else kids.push(h("div", { class: "note" }, t("panel.pickUseOps", { n: p.ops })));
    return h("div", { class: "panel" }, kids);
  }
  kids.push(h("div", { class: "row" }, cancelBtn(cs), confirmBtn(cs, sess)));
  return h("div", { class: "panel" }, kids);
}
function siegeRules(kind) {
  const S2 = E.SIEGE;
  const parts = [];
  if (!kind) return [t("rules.siege.pick")];
  for (const kk of [kind]) parts.push(h("div", {}, h("b", {}, t("opt.siege." + kk + "Name") + ":"), t("rules.siege." + kk, { f: S2.reinforceFactor, max: S2.reinforceMax, loss: S2.failLoss, cap: S2.capture, bonus: S2.siegeBonus, half: Math.round(S2.breakoutLoss * 100) })));
  return parts;
}

function footer(sess) {
  const v = sess.view();
  const cs = sess.choices();
  const mode = sess.mode();
  const turn = sess.turnOf();
  const kids = [];
  if (turn === "bot") {
    kids.push(feedLine(sess));
    kids.push(h("div", { class: "note" }, t("page.wait")));
    kids.push(handBlock(sess, [], v));
  } else if (mode && mode.kind === "pending") {
    kids.push(pendingPanel(sess, cs, v));
    kids.push(S.sheet ? null : feedLine(sess));
  } else if (mode && mode.kind === "headline") {
    const d = sess.draft;
    if (d.card) {
      const c = cardOf(d.card);
      kids.push(h("div", { class: "panel" }, h("div", { class: "hd" }, h("span", { class: "nm" }, c.zh), h("span", { class: "meta" }, t("panel.headlineMeta"))), h("div", { class: "tx" }, c.text), h("div", { class: "row" }, cancelBtn(cs), h("div", { class: "note", style: { flex: 1, alignSelf: "center" } }, t("panel.headlineConfirm")), confirmBtn(cs, sess))));
    } else { kids.push(feedLine(sess)); kids.push(h("div", { class: "note" }, t("panel.headlineHint"))); }
    kids.push(handBlock(sess, cs, v));
  } else if (mode && mode.kind === "action") {
    const panel = actionPanel(sess, cs, v);
    if (panel) kids.push(panel);
    else { kids.push(feedLine(sess)); kids.push(h("div", { class: "note" }, mode.kind === "action" && cs.some((c) => c.id === "use:bog") ? t("panel.bogHint") : t("panel.pickCard"))); }
    if (!sess.draft.use || sess.draft.use === "event" || sess.draft.use === "reform") kids.push(handBlock(sess, cs, v)); // while ops are being built the hand makes room (the cancel button brings it back)
  }
  return h("div", { class: "foot" }, kids);
}

// ---------- the map's taps ----------
function mapHighlights(sess) {
  const cs = sess.choices(), m = sess.mode(), d = sess.draft, v = sess.view();
  const targets = new Set(), chosen = new Set(), rings = {}, counts = {};
  for (const c of cs) {
    if (c.kind === "point+" || c.kind === "target") targets.add(c.space);
    if (c.kind === "option" && E.SPACE[c.option] && !(m && m.pending && m.pending.tag === "siege")) targets.add(c.option);
  }
  for (const id of d.points || []) { counts[id] = (counts[id] || 0) + 1; chosen.add(id); }
  if (d.target) chosen.add(d.target);
  if (m && m.pending) {
    const p = m.pending;
    if (p.tag === "siege") {
      chosen.add(p.target);
      for (const a of E.adjOf(v, p.target)) if (E.controller(v, a) === E.CCP) rings[a] = "from";
      for (const c of cs) if (c.kind === "option") { const [, R] = c.option.split(":"); if (R) rings[R] = c.selected ? "src2" : "src"; }
    } else if (p.target) chosen.add(p.target);
    if (d.sel && E.SPACE[d.sel]) chosen.add(d.sel);
  }
  return { targets, chosen, rings, counts };
}
function onMapTap(id) {
  const sess = S.sess;
  if (!sess || S.thinking || sess.turnOf() !== "human") return;
  const cs = sess.choices();
  const pick = cs.find((c) => c.id === `pt+:${id}`) || cs.find((c) => c.id === `tgt:${id}`) || cs.find((c) => c.id === `opt:${id}`);
  if (pick) { S.focus = id; tap(pick.id); return; }
  const minus = cs.find((c) => c.id === `pt-:${id}`);
  if (minus) { S.focus = id; tap(minus.id); }
}

// ---------- overlays ----------
function turnSummary(sess) {
  const v = sess.view();
  const T0 = v.turn - 1;
  const logT = (type) => v.log.filter((e) => e.t === T0 && e.type === type);
  const kids = [];
  const lines = [];
  const vps = v.log.filter((e) => e.t === T0 && e.type === "vp");
  for (const s of logT("score")) {
    const idx = v.log.findIndex((e) => e.i === s.i), vp = v.log[idx + 1];
    const signed = vp && vp.type === "vp" ? (vp.side === 0 ? vp.n : -vp.n) : 0;
    const lvl = (x) => `${x.total}${x.level === "none" ? "" : "(" + t("level." + x.level) + ")"}`;
    lines.push(h("div", { class: "ln" }, h("b", {}, t("summary.scoreOf", { region: T.region[s.region] })), ` ${t("summary.ccpShort")} ${lvl(s.ccp)} : ${t("summary.kmtShort")} ${lvl(s.kmt)} → `, h("b", { class: signed > 0 ? "r" : "b" }, signed ? t("summary.mandateMove", { side: signed > 0 ? T.side[0] : T.side[1], n: Math.abs(signed) }) : t("summary.noMove"))));
  }
  const att = logT("attrition")[0];
  if (att) lines.push(h("div", { class: "ln" }, h("b", {}, t("summary.attrition") + ":"), Object.entries(att.losses).map(([id, n]) => `${spaceZh(id)} ${t("log.blue", { n: "−" + n })}`).join("、")));
  const end = logT("endTurn")[0];
  if (end) lines.push(h("div", { class: "ln" }, h("b", {}, t("summary.weariness") + ":"), `${end.weariness} ${E.WEARINESS_NAMES[end.weariness]}`));
  for (const c of logT("capitalCheck")) lines.push(h("div", { class: "ln" }, h("b", {}, t("summary.capital") + ":"), t("summary.capitalLine", { side: T.side[c.whose], capital: spaceZh(c.capital), result: t("summary.capResult." + c.result) })));
  if (vps.length) lines.push(h("div", { class: "ln" }, h("b", {}, t("hud.mandate") + ":"), mandateLabel(v.mandate)));
  if (!lines.length) lines.push(h("div", { class: "ln" }, t("summary.none")));
  kids.push(h("div", { class: "lines" }, lines));
  kids.push(h("div", { class: "note" }, t("summary.mapNote")));
  kids.push(h("div", { class: "sheetrow" }, h("button", { class: "btn go" + (sess.side === 1 ? " kmt" : ""), onclick: () => { S.ack = v.turn; S.sheet = null; persist(); render(); } }, t("summary.go", { n: v.turn }))));
  return h("div", { class: "foot sum", "aria-label": t("summary.title", { n: T0 }) }, kids);
}
function feedSheet(sess) {
  const moves = sess.moves.filter((m) => m.entries.length || m.changes.length).slice(-30).reverse();
  const kids = [h("h2", {}, t("feed.all"))];
  let lastTurn = null;
  const lines = [];
  for (const m of moves) {
    if (m.turn !== lastTurn) { lines.push(h("div", { class: "tn" }, t("hud.turn", { n: m.turn }))); lastTurn = m.turn; }
    for (const l of moveLines(m)) lines.push(h("div", { class: "ln" + (m.by === "human" ? " hum" : "") }, l));
  }
  kids.push(h("div", { class: "lines" }, lines.length ? lines : h("div", { class: "note" }, t("feed.none"))));
  kids.push(h("div", { class: "sheetrow" }, h("button", { class: "btn", onclick: () => { S.sheet = null; render(); } }, t("page.close"))));
  return h("div", { class: "overlay", role: "dialog", "aria-label": t("feed.all") }, kids);
}
function menuSheet(sess) {
  const kids = [h("h2", {}, t("page.menu"))];
  kids.push(h("button", { class: "btn", style: { flexDirection: "row" }, onclick: () => { S.sheet = "feed"; render(); } }, t("feed.show")));
  kids.push(h("div", { class: "card" }, h("h2", {}, t("legend.title")), h("div", { class: "note" }, [t("legend.red"), t("legend.blue"), t("legend.isolated"), t("legend.besieged"), t("legend.chg")].map((x) => h("div", {}, x)))));
  kids.push(h("div", { class: "note" }, t("page.levelLine", { level: T.level[sess.level] || sess.level, side: T.side[sess.side] })));
  kids.push(h("button", { class: "btn", style: { flexDirection: "row" }, onclick: () => { if (confirm(t("page.newConfirm"))) location.href = `game.html?new&side=${sess.side}`; } }, t("page.newGame")));
  kids.push(h("a", { class: "btn", style: { flexDirection: "row", textDecoration: "none" }, href: "./" }, t("page.back")));
  kids.push(h("div", { class: "sheetrow" }, h("button", { class: "btn", onclick: () => { S.sheet = null; render(); } }, t("page.close"))));
  return h("div", { class: "overlay", role: "dialog", "aria-label": t("page.menu") }, kids);
}

// ---------- the end ----------
function mandateCurve(v) {
  // Rebuilt from the log's 民心 entries, one point per turn. view.mandateByTurn (#45) replaces this once it has landed.
  const last = Math.max(...v.log.map((e) => e.t));
  const pts = [{ t: 0, m: 0 }];
  let m = 0;
  for (let k = 1; k <= last; k++) { for (const e of v.log) if (e.t === k && e.type === "vp") m = e.mandate; pts.push({ t: k, m }); }
  return pts;
}
function curveChart(v) {
  const curve = mandateCurve(v);
  const W = 358, H = 200, L = 34, R = 10, Tp = 10, B = 22;
  const [toC, toK] = E.MANDATE_WIN;
  const lo = -toK - 2, hi = toC + 2;
  const x = (k) => L + ((W - L - R) * k) / Math.max(1, curve.length - 1);
  const y = (m) => Tp + ((hi - m) / (hi - lo)) * (H - Tp - B);
  const svg = h("svg:svg", { width: "100%", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": t("end.curveLabel") + curve.map((p) => `${p.t}:${mandateLabel(p.m)}`).join(",") },
    h("svg:rect", { x: L, y: Tp, width: W - L - R, height: y(toC) - Tp, fill: "#F3DEDB" }),
    h("svg:rect", { x: L, y: y(-toK), width: W - L - R, height: H - B - y(-toK), fill: "#DCE6F2" }));
  for (const [m, col] of [[toC, "#A3241B"], [0, "#22302B"], [-toK, "#1D4E89"]]) {
    svg.append(h("svg:line", { x1: L, x2: W - R, y1: y(m), y2: y(m), stroke: col, "stroke-width": m === 0 ? 1.5 : 2 }));
    svg.append(h("svg:text", { x: L - 4, y: y(m) + 4, "text-anchor": "end", "font-size": 11, "font-weight": 700, fill: col }, m === 0 ? "0" : m > 0 ? "+" + m : "−" + -m));
  }
  svg.append(h("svg:polyline", { points: curve.map((p) => `${x(p.t)},${y(p.m)}`).join(" "), fill: "none", stroke: "#22302B", "stroke-width": 3, "stroke-linejoin": "round" }));
  for (const p of curve) {
    svg.append(h("svg:circle", { cx: x(p.t), cy: y(p.m), r: 4.5, fill: p.m > 0 ? "#A3241B" : p.m < 0 ? "#1D4E89" : "#22302B", stroke: "#fff", "stroke-width": 1.5 }));
    svg.append(h("svg:text", { x: x(p.t), y: H - 6, "text-anchor": "middle", "font-size": 11, fill: "#3C4A44" }, p.t === 0 ? t("end.start") : p.t));
  }
  return svg;
}
function endScreen(sess) {
  const v = sess.view(), me = sess.side, won = v.winner === me;
  const regionRows = E.SCORED_REGIONS.map((r) => {
    const ids = E.spacesOf(r), own = [0, 1].map((s) => ids.filter((id) => E.controller(v, id) === s).length);
    return h("div", { class: "reg" }, h("b", {}, T.region[r]), h("span", { class: "r" }, own[0]), h("span", { class: "b" }, own[1]), h("span", {}, ids.length - own[0] - own[1]));
  });
  const mini = renderMap(v, { static: true }); mini.classList.add("mini");
  const reasonKey = "end.reason." + v.reason;
  const reason = t(reasonKey).startsWith("end.reason.") ? t("end.reason.other", { reason: v.reason }) : t(reasonKey);
  const mie = Object.keys(v.mie || {}).length, seals = Object.keys(v.seals || {}).length;
  return [
    topBar(v, sess, { line1: t("end.topline", { n: v.turn }), line2: t("end.record"), chip: t("page.gameOver") }),
    h("div", { class: "end", style: { background: v.winner === 0 ? "var(--red)" : "var(--blue)" } },
      h("div", { class: "big" }, t("end.winner", { side: T.side[v.winner] })), h("div", { class: "why" }, reason), h("div", { class: "you" }, t(won ? "end.win" : "end.lose"))),
    h("div", { class: "body" },
      h("div", { class: "card" }, h("h2", {}, t("end.curve")), curveChart(v)),
      h("div", { class: "card", style: { display: "flex", gap: "8px" } },
        h("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" } }, h("h2", {}, t("end.board")),
          h("div", { class: "reg hd" }, h("span", {}, t("end.control")), h("span", { class: "r" }, T.sideShort[0]), h("span", { class: "b" }, T.sideShort[1]), h("span", {}, t("end.none"))), regionRows,
          h("div", { class: "trk", style: { marginTop: "4px", flexWrap: "wrap", rowGap: "2px" } }, h("b", {}, t("end.mie")), h("span", { class: "r" }, `${mie}/${v.options.mie}`), h("b", { style: { marginLeft: "8px" } }, t("end.seal")), h("span", { class: "b" }, `${seals}/${v.options.seals}`))),
        h("div", { class: "miniwrap", "aria-label": t("end.miniLabel") }, mini)),
      h("div", { class: "again" }, h("a", { class: "btn go fl", style: { textDecoration: "none" }, href: `game.html?new&side=${me}` }, t("end.again")), h("button", { class: "btn fl", onclick: () => { S.review = true; render(); } }, t("end.review")), h("a", { class: "btn fl", style: { textDecoration: "none" }, href: "./" }, t("end.home")))),
  ];
}

// ---------- render ----------
function render() {
  const sess = S.sess;
  if (!sess) return;
  try {
    const v = sess.view();
    let kids;
    if (sess.over() && !S.review) kids = endScreen(sess);
    else {
      const hl = mapHighlights(sess);
      const changes = stretchChanges(sess);
      const summary = !sess.over() && sess.turnOf() === "human" && v.turn > S.ack && v.turn >= 2 && !S.sheet;
      const attr = summary ? (v.log.filter((e) => e.t === v.turn - 1 && e.type === "attrition")[0] || { losses: {} }).losses : null;
      const targets = summary ? new Set(Object.keys(attr)) : hl.targets;
      const map = mapBlock(v, { targets, chosen: hl.chosen, rings: hl.rings, counts: hl.counts, changes: summary ? null : changes, onTap: onMapTap, prefix: summary ? t("hud.nextSituation") : null });
      kids = [topBar(v, sess, sess.over() ? { line1: t("end.topline", { n: v.turn }), line2: t("end.record"), chip: t("page.gameOver") } : summary ? { line1: t("summary.topline", { n: v.turn - 1, era: eraZh(v) }), line2: t("summary.topline2", { sit: (E.situationOf(v.turn - 1) || {}).zh, year: (E.situationOf(v.turn - 1) || {}).year }), chip: t("summary.chip") } : null), map];
      if (sess.over()) kids.push(h("div", { class: "foot" }, h("div", { class: "again" }, h("button", { class: "btn go fl", onclick: () => { S.review = false; render(); } }, t("end.back")))));
      else if (summary) kids.push(turnSummary(sess));
      else kids.push(footer(sess));
      if (S.sheet === "menu") kids.push(menuSheet(sess));
      else if (S.sheet === "feed") kids.push(feedSheet(sess));
    }
    if (S.toast) kids.push(h("div", { class: "toast", role: "status" }, S.toast));
    app.replaceChildren(...kids);
  } catch (e) { showError(e); }
}
function showError(e) {
  console.error(e);
  app.replaceChildren(h("div", { class: "err" }, h("h2", {}, t("err.title")), h("p", {}, t("err.generic", { msg: String((e && e.message) || e) })),
    h("div", { class: "again" }, h("button", { class: "btn fl", onclick: () => location.reload() }, t("err.reload")), h("a", { class: "btn go fl", style: { textDecoration: "none" }, href: "game.html?new&side=0" }, t("page.newGame")))));
}

// ---------- taps and the bot ----------
function tap(id) {
  const sess = S.sess;
  if (!sess || S.thinking) return;
  try {
    sess.tap(id, { bots: false });
  } catch (e) { showError(e); return; }
  if (id !== "confirm") { /* focus follows the last point tapped */ const m = /^pt[+-]:(.+)$/.exec(id); if (m) S.focus = m[1]; }
  persist(); render();
  if (sess.turnOf() === "bot") drive();
}
let worker = null, workerBad = false, wid = 0;
const waiting = new Map();
function getWorker() {
  if (worker || workerBad) return worker;
  try {
    worker = new Worker(new URL("./botworker.js", import.meta.url), { type: "module" });
    worker.onmessage = (ev) => { const w = waiting.get(ev.data.id); if (!w) return; waiting.delete(ev.data.id); if (ev.data.error) w.rej(new Error(ev.data.error)); else w.res(ev.data.action); };
    worker.onerror = () => { workerBad = true; worker = null; for (const w of waiting.values()) w.rej(new Error("worker")); waiting.clear(); };
  } catch { workerBad = true; worker = null; }
  return worker;
}
function decide(task) {
  const local = () => new Promise((res, rej) => setTimeout(() => { try { res(decideTask(task)); } catch (e) { rej(e); } }, 20));
  const w = getWorker();
  if (!w) return local();
  return new Promise((res, rej) => { const id = ++wid; waiting.set(id, { res, rej }); w.postMessage({ id, task }); }).catch((e) => (workerBad || /worker/.test(String(e && e.message)) ? local() : Promise.reject(e)));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function drive() {
  if (S.driving) return;
  S.driving = true;
  try {
    const sess = S.sess;
    while (sess.turnOf() === "bot") {
      S.thinking = true; render();
      const t0 = Date.now();
      const task = sess.botTask();
      const a = await decide(task);
      if (!a) throw new Error("the bot has no action");
      const wait = Math.max(0, 350 - (Date.now() - t0)); if (wait) await sleep(wait);
      sess.botApply(a);
      persist();
      const rec = sess.moves[sess.moves.length - 1];
      S.thinking = true; render();
      if (sess.turnOf() === "bot") await sleep(rec && (rec.changes.length || rec.entries.some((e) => ["play", "siegeResult", "place", "eventEnd"].includes(e.type))) ? STEP_MS : QUICK_MS);
    }
  } catch (e) { S.driving = false; S.thinking = false; showError(e); return; }
  S.thinking = false; S.driving = false;
  render();
}

// ---------- saving ----------
function persist() {
  if (!S.sess) return;
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, session: S.sess.toJSON(), ack: S.ack })); S.saveOk = true; }
  catch { if (S.saveOk) { S.saveOk = false; S.toast = t("page.saveOff"); setTimeout(() => { S.toast = null; render(); }, 6000); } }
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { sess: null };
    const data = JSON.parse(raw);
    return { sess: restoreSession(data.session, { bots: false }), ack: data.ack || 1 };
  } catch (e) { return { sess: null, bad: true }; }
}

// ---------- the map's scale below 390 px wide ----------
function fit() {
  const w = Math.min(document.documentElement.clientWidth || 390, 390);
  document.documentElement.style.setProperty("--s", String(Math.min(1, w / 390)));
}

// ---------- boot ----------
function boot() {
  fit();
  window.addEventListener("resize", fit);
  const q = new URLSearchParams(location.search);
  const wantNew = q.has("new");
  let toast = null;
  let sess = null;
  if (!wantNew) {
    const r = load();
    if (r.sess) { sess = r.sess; S.ack = r.ack; } else if (r.bad) toast = t("page.saveBad");
  }
  if (!sess) {
    const side = q.get("side") === "1" ? 1 : 0;
    const seed = q.has("seed") && Number.isFinite(+q.get("seed")) ? +q.get("seed") : undefined;
    const level = ["easy", "normal", "hard"].includes(q.get("level")) ? q.get("level") : "normal";
    sess = createSession({ seed, side, level, bots: false });
    S.ack = 1;
  }
  S.sess = sess;
  if (wantNew || toast) { try { history.replaceState(null, "", location.pathname); } catch { /* ignore */ } }
  if (toast) { S.toast = toast; setTimeout(() => { S.toast = null; render(); }, 6000); }
  persist();
  render();
  if (sess.turnOf() === "bot") drive();
}
try { boot(); } catch (e) { showError(e); }
window.addEventListener("error", (e) => { if (!S.sess) showError(e.error || e.message); });
