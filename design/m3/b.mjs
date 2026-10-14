// B: the Nationalists answer a 圍點打援. The options are the engine's own (`view.pending.options`).
// The Communists' plan (打點 / 打援) is face down: in `view.plan` it is null for this seat.
import { E, h, loadState, renderMap, topBar, trackPanel, cornerSouthWest } from "./lib.mjs";

const { meta, view: v, legal: L } = await loadState("state-b.json");
const me = meta.side;
const p = L.pending;                       // { who, kind: "option", tag: "siege", target, ops, options: [{ id }] }
const T = p.target, X = p.ops;
const zh = (id) => E.SPACE[id].zh;
const blue = (id) => E.infOf(v, id)[1];
const D = blue(T), room = E.capOf(v, T) - D;
const attackers = E.adjOf(v, T).filter((a) => E.controller(v, a) === E.CCP);
const app = document.getElementById("app");

const parse = (id) => { const [kind, R, k] = id.split(":"); return { kind, R, k: Number(k) || 0, id }; };
const opts = p.options.map((o) => parse(o.id));
const ui = { pick: (opts.find((o) => o.kind === "reinforce") || opts[0]).id };

const S = E.SIEGE;
// What each plan would do to this answer: the rule table of mechanism B (the engine's SIEGE numbers), as text.
function outcome(o) {
  const point = [], relief = [];
  if (o.kind === "hold") {
    const rm = Math.min(X, D);
    point.push(`守軍被移除 ${rm},剩下的 ${X - rm} 放成紅。`);
    relief.push(`沒有損失;${zh(T)} 被圍,本回合算孤城,共軍下次打它 +${S.siegeBonus}。`);
  } else if (o.kind === "reinforce") {
    const a = Math.max(0, X - S.reinforceFactor * o.k);
    point.push(`攻擊力 ${X} → ${a};${zh(T)} 藍 ${D + o.k} 被移除 ${Math.min(a, D + o.k)}${a === 0 ? ",共軍 −" + S.failLoss : ""}。`);
    relief.push(`${zh(o.R)} 的援軍被殲 ${Math.min(o.k, X)},共軍繳獲 +${S.capture}。`);
  } else {
    const rm = Math.min(Math.ceil(D * S.breakoutLoss), X);
    point.push(`${zh(T)} 藍 ${D} 全撤到 ${zh(o.R)},空城歸共軍(紅 +${X})。`);
    relief.push(`撤走的藍損失 ${rm},剩 ${D - rm} 到 ${zh(o.R)};城丟,共軍 +${S.capture}。`);
  }
  return { point: point.join(""), relief: relief.join("") };
}
const title = (o) => (o.kind === "hold" ? "固守" : o.kind === "reinforce" ? `增援 ${zh(o.R)} ${o.k} 點` : `突圍 → ${zh(o.R)}`);
const sub = (o) => (o.kind === "hold" ? `${zh(T)} 藍 ${D} 守住` : o.kind === "reinforce" ? `${zh(o.R)} 藍 ${blue(o.R)}→${blue(o.R) - o.k} · ${zh(T)} ${D}→${D + o.k}` : `${zh(T)} 藍 ${D} 點撤走`);

function render() {
  const sel = opts.find((o) => o.id === ui.pick);
  const rings = {};
  for (const a of attackers) rings[a] = "from";
  for (const o of opts) if (o.R) rings[o.R] = o.R === sel.R ? "src2" : "src";
  const map = renderMap(v, { chosen: T, rings });
  map.append(trackPanel(v), cornerSouthWest(v));
  const out = outcome(sel);
  const sheet = h("div", { class: "sheet" },
    h("div", { class: "card", style: { padding: "4px 8px" } },
      h("div", { style: { display: "flex", gap: "6px", alignItems: "baseline" } }, h("h2", { style: { margin: 0 } }, `共軍進攻 ${zh(T)}`), h("span", { class: "tag r" }, `攻擊力 ${X}`), h("span", { class: "note" }, `藍 ${D} · 空位 ${room}`)),
      h("div", { class: "note" }, "共軍已暗選「打點」或「打援」,你答完才翻開。")),
    h("div", { class: "grid2" }, opts.map((o) => h("button", { class: "btn opt" + (o.id === ui.pick ? " on" : ""), "aria-pressed": o.id === ui.pick ? "true" : "false", onclick: () => { ui.pick = o.id; render(); } }, title(o), h("small", {}, sub(o))))),
    h("div", { class: "card", style: { padding: "4px 8px" } },
      h("div", { class: "note" }, h("b", { class: "r" }, "若是打點 "), out.point),
      h("div", { class: "note" }, h("b", { class: "r" }, "若是打援 "), out.relief)),
    h("div", { class: "legend" }, h("span", {}, h("i", { style: { border: "3px dashed #A3241B" } }), "共軍來處"), h("span", {}, h("i", { style: { border: "3px solid #1D4E89" } }), "增援 / 突圍的去處"), h("span", {}, h("i", { style: { border: "4px solid #E0A100" } }), "被打的城")),
    h("button", { class: "btn go kmt", style: { minHeight: "44px", flexDirection: "row", gap: "8px" } }, `確定:${title(sel)}`));
  app.replaceChildren(topBar(v, { me }), map, sheet);
}
render();
