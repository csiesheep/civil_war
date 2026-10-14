// C: what the turn that just ended did. Everything is read from the log of state-c.json (turn 5's entries),
// the board behind it is the board after the 結算. Nothing is asked of the player here: one button.
import { E, h, loadState, renderMap, topBar, trackPanel, cornerSouthWest, mandateSteps, logOf, mandateLabel, LEVEL_ZH, eraZh, SIDE_ZH } from "./lib.mjs";

const { meta, view: v } = await loadState("state-c.json");
const T = meta.summaryTurn;
const me = meta.side;
const app = document.getElementById("app");
const sit = E.situationOf(T);
const zh = (id) => E.SPACE[id].zh;

const steps = mandateSteps(v).filter((s) => s.t === T);
const scores = logOf(v, T, "score");
const attrition = logOf(v, T, "attrition")[0];
const tires = logOf(v, T, "tire");
const endTurn = logOf(v, T, "endTurn")[0];
const startM = steps.length ? steps[0].before : v.mandate;
const endM = steps.length ? steps[steps.length - 1].after : v.mandate;
const checks = logOf(v, T, "capitalCheck");
const prevEnd = (v.log.filter((e) => e.t === T - 1 && e.type === "endTurn")[0] || {}).weariness;
const wear0 = prevEnd ?? 5;
const lowest = tires.length ? tires[tires.length - 1].to : wear0;

const lost = attrition ? Object.entries(attrition.losses) : [];
const hit = new Set(lost.map(([id]) => id));

function scoreLine(s) {
  const vp = v.log[v.log.findIndex((e) => e.i === s.i) + 1];
  const signed = vp && vp.type === "vp" ? (vp.side === 0 ? vp.n : -vp.n) : 0;
  const st = steps.find((x) => vp && x.i === vp.i);
  const lvl = (x) => `${x.total}${x.level === "none" ? "" : "(" + LEVEL_ZH[x.level] + ")"}`;
  return h("div", { class: "note", style: { color: "var(--ink)" } },
    h("b", {}, `${E.REGIONS[s.region].zh}記分`), ` 共 ${lvl(s.ccp)} : 國 ${lvl(s.kmt)} → 民心 `,
    h("b", { class: signed > 0 ? "r" : "b" }, `${signed > 0 ? "共" : "國"} +${Math.abs(signed)}`),
    st && st.clamped ? h("span", { class: "tag", style: { marginLeft: "4px", background: "var(--amber)" } }, "擋在上限") : null);
}

const sheet = h("div", { class: "sheet" },
  h("div", { class: "card", style: { padding: "4px 8px" } },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } }, h("h2", { style: { margin: 0 } }, "民心與記分"),
      h("span", { style: { fontWeight: 900 } }, mandateLabel(startM), " → ", h("span", { class: endM > 0 ? "r" : endM < 0 ? "b" : "" }, mandateLabel(endM)))),
    scores.length ? scores.map(scoreLine) : h("div", { class: "note" }, "這回合沒有記分。"),
    steps.some((s) => s.clamped) ? h("div", { class: "note" }, `第 ${E.MANDATE_FROM[1]} 回合前國軍最多領先 ${E.MANDATE_CAP[1]}:多出來的民心沒有算。`) : null),
  h("div", { class: "card", style: { padding: "4px 8px" } },
    h("h2", { style: { margin: 0 } }, `孤城掉點(地圖上金框)`),
    lost.length ? h("div", { class: "note", style: { color: "var(--ink)" } }, lost.map(([id, n]) => `${zh(id)} 藍 −${n}`).join("、")) : h("div", { class: "note" }, "沒有孤城掉點。")),
  h("div", { class: "card", style: { padding: "4px 8px" } },
    h("div", { class: "note", style: { color: "var(--ink)" } },
      h("b", {}, "民生 "), `${wear0} → ${lowest}(推要衝)→ 回復 +1 → ${endTurn ? endTurn.weariness : v.weariness} ${E.WEARINESS_NAMES[endTurn ? endTurn.weariness : v.weariness]}`),
    h("div", { class: "note", style: { color: "var(--ink)" } },
      h("b", {}, "首都 "), checks.map((c) => `${SIDE_ZH[c.whose]}${zh(c.capital)} ${c.result === "safe" ? "安全" : c.result}`).join("、"))),
  h("button", { class: "btn go", style: { minHeight: "44px", flexDirection: "row" } }, `進入第 ${v.turn} 回合 · ${E.situationOf(v.turn).zh}`));

const map = renderMap(v, { targets: hit });
map.append(trackPanel(v), cornerSouthWest(v, { prefix: "下回合時局" }));
app.replaceChildren(topBar(v, { me, line1: `第 ${T} 回合 結算 · ${eraZh(v)}`, extra: `${sit.zh} · ${sit.year}`, chipText: "結算" }), map, sheet);
