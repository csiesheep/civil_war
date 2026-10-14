// D: the end of the game. Winner and reason are `view.winner` / `view.reason`; the 民心 curve is rebuilt
// from the log's `vp` entries (turn by turn); the board summary reads the final influence.
import { E, h, SVGNS, loadState, renderMap, mandateCurve, mandateLabel, topBar, REASON_ZH, SIDE_ZH, eraZh } from "./lib.mjs";

const { meta, view: v } = await loadState("state-d.json");
const me = meta.side;
const app = document.getElementById("app");
const won = v.winner === me;
const curve = mandateCurve(v);
if (curve[curve.length - 1].m !== v.mandate) console.warn("curve ends at", curve[curve.length - 1].m, "but the state says", v.mandate);

// ---- the curve ----
function chart() {
  const W = 358, H = 236, L = 34, R = 10, Tp = 10, B = 22;
  const [toC, toK] = E.MANDATE_WIN;
  const lo = -toK - 2, hi = toC + 2;
  const x = (t) => L + ((W - L - R) * t) / (curve.length - 1);
  const y = (m) => Tp + ((hi - m) / (hi - lo)) * (H - Tp - B);
  const svg = h("svg:svg", { width: "100%", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "民心曲線:" + curve.map((p) => `第${p.t}回合 ${mandateLabel(p.m)}`).join(",") },
    h("svg:rect", { x: L, y: Tp, width: W - L - R, height: y(toC) - Tp, fill: "#F3DEDB" }),
    h("svg:rect", { x: L, y: y(-toK), width: W - L - R, height: H - B - y(-toK), fill: "#DCE6F2" }));
  for (const [m, label, col, dash] of [[toC, `共勝 +${toC}`, "#A3241B", null], [0, "0", "#22302B", null], [-toK, `國勝 −${toK}`, "#1D4E89", null]]) {
    svg.append(h("svg:line", { x1: L, x2: W - R, y1: y(m), y2: y(m), stroke: col, "stroke-width": m === 0 ? 1.5 : 2, "stroke-dasharray": dash }));
    svg.append(h("svg:text", { x: L - 4, y: y(m) + 4, "text-anchor": "end", "font-size": 11, "font-weight": 700, fill: col }, m === 0 ? "0" : String(m > 0 ? "+" + m : "−" + -m)));
  }
  // the bounds before each side may win on the mandate: +19 before turn 7, −3 before turn 6 (MANDATE_CAP / MANDATE_FROM)
  svg.append(h("svg:line", { x1: x(0), x2: x(E.MANDATE_FROM[0] - 1), y1: y(E.MANDATE_CAP[0]), y2: y(E.MANDATE_CAP[0]), stroke: "#A3241B", "stroke-dasharray": "3 3" }));
  svg.append(h("svg:line", { x1: x(0), x2: x(E.MANDATE_FROM[1] - 1), y1: y(-E.MANDATE_CAP[1]), y2: y(-E.MANDATE_CAP[1]), stroke: "#1D4E89", "stroke-dasharray": "3 3" }));
  svg.append(h("svg:polyline", { points: curve.map((p) => `${x(p.t)},${y(p.m)}`).join(" "), fill: "none", stroke: "#22302B", "stroke-width": 3, "stroke-linejoin": "round" }));
  for (const p of curve) {
    svg.append(h("svg:circle", { cx: x(p.t), cy: y(p.m), r: 5, fill: p.m > 0 ? "#A3241B" : p.m < 0 ? "#1D4E89" : "#22302B", stroke: "#fff", "stroke-width": 1.5 }));
    svg.append(h("svg:text", { x: x(p.t), y: H - 6, "text-anchor": "middle", "font-size": 11, fill: "#3C4A44" }, p.t === 0 ? "起" : p.t));
  }
  const last = curve[curve.length - 1];
  svg.append(h("svg:text", { x: x(last.t) - 8, y: y(last.m) - 9, "text-anchor": "end", "font-size": 13, "font-weight": 900, fill: "#22302B" }, mandateLabel(last.m)));
  return svg;
}

// ---- who holds each region (a strip of squares, one per space) ----
function regionRows() {
  return E.SCORED_REGIONS.map((r) => {
    const ids = E.spacesOf(r);
    const own = [0, 1].map((s) => ids.filter((id) => E.controller(v, id) === s).length);
    return h("div", { class: "reg" },
      h("b", {}, E.REGIONS[r].zh), h("span", { class: "r" }, own[0]), h("span", { class: "b" }, own[1]), h("span", {}, ids.length - own[0] - own[1]));
  });
}

const mini = renderMap(v, { static: true });
mini.classList.add("mini");
const miniWrap = h("div", { class: "miniwrap", "aria-label": "終局的棋盤(縮小)" }, mini);

const mie = Object.keys(v.mie || {}).length, seals = Object.keys(v.seals || {}).length;
const page = [
  topBar(v, { me, line1: `終局 · 第 ${v.turn} 回合 · ${eraZh(v)}`, extra: "這一局的紀錄", chipText: "終局" }),
  h("div", { class: "end", style: { background: v.winner === 0 ? "var(--red)" : "var(--blue)" } },
    h("div", { class: "big" }, `${SIDE_ZH[v.winner]}勝`),
    h("div", { class: "why" }, REASON_ZH[v.reason] || v.reason),
    h("div", { class: "you" }, won ? "你贏了" : "你輸了")),
  h("div", { class: "body" },
    h("div", { class: "card" }, h("h2", {}, "民心(每回合結束時)"), h("div", { class: "note", style: { margin: "-2px 0 2px" } }, "虛線是還不能靠民心獲勝時的上限"), chart()),
    h("div", { class: "card", style: { display: "flex", gap: "8px" } },
      h("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" } }, h("h2", {}, "終局的棋盤"), h("div", { class: "reg hd" }, h("span", {}, "控制"), h("span", { class: "r" }, "共"), h("span", { class: "b" }, "國"), h("span", {}, "空")), regionRows(),
        h("div", { class: "trk", style: { marginTop: "4px", flexWrap: "wrap", rowGap: "2px" } }, h("b", {}, "易幟"), h("span", { class: "r" }, `${mie}/${v.options.mie}`), h("b", { style: { marginLeft: "8px" } }, "整編"), h("span", { class: "b" }, `${seals}/${v.options.seals}`), h("b", { style: { marginLeft: "8px" } }, "民生"), h("span", {}, `${v.weariness}`))),
      miniWrap),
    h("div", { class: "row" }, h("button", { class: "btn go fl" }, "再玩一局"), h("button", { class: "btn fl" }, "看棋盤"), h("button", { class: "btn fl" }, "回標題")))];
app.replaceChildren(...page);
