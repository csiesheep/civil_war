// A: an action round. The Communists (the player), turn 5, a card tapped, the action panel open.
// Every number comes from state-a.json = { view: E.view(st, CCP), legal: E.legal(st, CCP) }.
import { E, h, loadState, renderMap, topBar, trackPanel, cornerSouthWest, cardChip, cardOf, USE_ZH, eraZh, SIDE_ZH, MAP_H } from "./lib.mjs";

const { meta, view: v, legal: L } = await loadState("state-a.json");
const me = meta.side;
const app = document.getElementById("app");

const ui = { card: meta.selectedCard, use: "campaign", target: null, plan: "point" };

const entry = (id) => (L.aid && L.aid.id === id ? { id, ops: L.aid.ops, uses: { event: false, place: L.aid.place, campaign: L.aid.campaign, lobby: L.aid.lobby, reform: false } } : L.cards.find((c) => c.id === id));
const targetsOf = (e, use) => {
  const u = e && e.uses[use];
  if (!u || u === true) return [];
  if (use === "place") return u.options.map((o) => o.id);
  if (use === "lobby") return u.targets.map((t) => t.id);
  return u.targets;
};
// the first time: the city under attack that has the most Nationalist points (a stand-in for the player's tap)
function defaultTarget() {
  const e = entry(ui.card);
  const t = targetsOf(e, "campaign").filter((id) => E.SPACE[id].kind === "city");
  t.sort((a, b) => E.infOf(v, b)[1] - E.infOf(v, a)[1]);
  return t[0] || null;
}
ui.target = defaultTarget();

function useButtons(e) {
  const defs = [["event", e.uses.event ? (e.uses.enemy ? "對手事件" : "") : null], ["place", null], ["campaign", null], ["lobby", null], ["reform", null]];
  return defs.map(([u]) => {
    const x = e.uses[u];
    const n = u === "place" ? (x ? x.options.length : 0) : u === "campaign" ? (x ? x.targets.length : 0) : u === "lobby" ? (x ? x.targets.length : 0) : 0;
    const sub = u === "event" ? (e.uses.enemy ? "給對手" : "") : u === "reform" ? (x ? "" : "不能") : (x ? `${n} 處` : "無");
    return h("button", { class: "btn fl" + (ui.use === u ? " on" : ""), disabled: !x || null, "aria-pressed": ui.use === u ? "true" : "false", onclick: () => { ui.use = u; if (u === "campaign") ui.target = defaultTarget(); else ui.target = null; render(); } },
      USE_ZH[u], sub ? h("small", {}, sub) : null);
  });
}
function contextRow(e) {
  const u = ui.use;
  const sub = [];
  if (u === "event") {
    return h("div", { class: "row" }, h("div", { class: "note", style: { flex: 1, alignSelf: "center" } }, e.uses.enemy ? "這是國軍的牌:打出去,事件照牌上寫的發生(對你不利的也算)。" : "打出事件,不花行動點。"), h("button", { class: "btn go", style: { minWidth: "96px" } }, "打出事件"));
  }
  if (u === "reform") return h("div", { class: "row" }, h("div", { class: "note", style: { flex: 1, alignSelf: "center" } }, `用這張牌推建軍軌一格(${E.reformName(0, v.reform[0] + 1) || "—"})。`), h("button", { class: "btn go", style: { minWidth: "96px" } }, "推一格"));
  const tgt = ui.target;
  const isCity = tgt && E.SPACE[tgt].kind === "city";
  const cost = u === "place" && tgt ? (entry(ui.card).uses.place.options.find((o) => o.id === tgt) || {}).cost : null;
  return h("div", { class: "row" },
    h("div", { class: "btn", style: { minWidth: "84px", flexDirection: "column" } }, tgt ? E.SPACE[tgt].zh : "點地圖", h("small", {}, tgt ? (u === "place" ? `每點 ${cost}` : u === "lobby" ? "遊說" : "進攻") : "選目標")),
    u === "campaign" && isCity ? [["point", "打點"], ["relief", "打援"]].map(([k, z]) => h("button", { class: "btn fl" + (ui.plan === k ? " on" : ""), "aria-pressed": ui.plan === k ? "true" : "false", onclick: () => { ui.plan = k; render(); } }, z, h("small", {}, k === "point" ? "強攻守軍" : "圍城等援"))) : h("div", { class: "note", style: { flex: 1, alignSelf: "center" } }, u === "campaign" ? "鄉:破襲,直接打。" : u === "place" ? `${e.ops} 點,可分到幾處。` : "擲骰,結果看雙方優勢。"),
    h("button", { class: "btn go", style: { minWidth: "72px" }, disabled: !tgt || null }, "確定"));
}
function footer() {
  const e = entry(ui.card);
  const c = cardOf(ui.card);
  const aid = E.isAid(ui.card);
  const panel = h("div", { class: "panel", "aria-label": "行動面板" },
    h("div", { class: "hd" }, h("span", { class: "nm" }, c.zh), h("span", { class: "meta" }, aid ? `外援 · ${e.ops} 點` : `${SIDE_ZH[c.side] ?? "中立"} · ${e.ops} 點 · ${c.year}`)),
    aid ? null : h("div", { class: "tx" }, c.text),
    h("div", { class: "row" }, useButtons(e), h("button", { class: "btn", "aria-label": "放回手牌", onclick: () => { ui.card = null; render(); } }, "✕")),
    contextRow(e));
  const cards = v.hands[me].map((id) => cardChip(id, { sel: id === ui.card, onTap: () => { ui.card = id; ui.use = "campaign"; if (!entry(id).uses.campaign) ui.use = "event"; ui.target = ui.use === "campaign" ? defaultTarget() : null; render(); } }));
  if (L.aid) cards.push(cardChip(L.aid.id, { sel: ui.card === L.aid.id, label: L.aid.ops, onTap: () => { ui.card = L.aid.id; ui.use = "campaign"; ui.target = defaultTarget(); render(); } }));
  return h("div", { class: "foot" }, ui.card ? panel : h("div", { class: "panel" }, h("div", { class: "note" }, "選一張牌。")), h("div", { class: "hand" }, cards));
}
function render() {
  const e = ui.card && entry(ui.card);
  const t = e && new Set(targetsOf(e, ui.use));
  const map = renderMap(v, {
    targets: t, chosen: ui.target,
    onTap: (id) => { if (t && t.has(id)) { ui.target = id; render(); } },
  });
  map.append(trackPanel(v), cornerSouthWest(v));
  app.replaceChildren(topBar(v, { me }), map, footer());
}
render();
document.title = "A 行動回合 · 牌桌 mockup";
