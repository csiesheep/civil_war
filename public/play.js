// public/play.js -- the layer behind the game page (#44, M3 (2)). An ES module that never touches the DOM.
//
// What it is: one game against the bot, seen from one seat. It holds the engine's whole state (`st`, both hands
// included), the human's half-built action (`draft`), and a short record of the moves made (`moves`). The page
// reads `view()` (= E.view(st, side), the opponent's hand hidden), `choices()` (what can be tapped now) and sends
// `tap(id)`. No rule lives here: what may be tapped comes from `E.legal`, `E.placeTargets`, `E.opsOptions` and the
// pending decision's own fields; a tap that completes an action sends it to `E.apply` and nothing else.
//
// The layers of a tap, in an action round:   card -> use -> (order) -> targets / points -> confirm
//   card:<id>     a card of the hand (or the aid card, or -- under a 頓兵堅城 -- one of the cards to throw away)
//   use:<use>     event / place / campaign / lobby / reform / bog / pair (馬歇爾調處's pairing)
//   pair:<card>   (pair only) which enemy card to borrow the ops from;  puse:<use>  what to do with them
//   order:<o>     (an enemy card's ops) opsFirst / eventFirst
//   tgt:<space>   campaign / lobby target;  plan:point|relief  (an attack on a city must name its plan)
//   pt+:<space> / pt-:<space>   one more / one fewer point of a 扶植 (or of a pending "points" choice)
//   confirm       sends the action;  cancel  empties the draft
// A pending decision (the engine asks): opt:<id> (an option, then confirm), pc:<card> (toggle, then confirm),
// pt+ / pt- (points, then confirm), or the same builder as an action round's ops (a pending "ops").
// The headline is card:<id> then confirm.
//
// The bot: `tap(id)` runs the bot to the human's next decision (synchronously: the tests use it). The page uses
// `tap(id, { bots: false })` and then `botTask()` -> (decideTask in a Web Worker, or here) -> `botApply(action)`, so
// a long think never freezes the page. The bot's random numbers come from (seed, number of actions so far) alone,
// so the same game replays the same way, and a saved game needs no generator state.
//
// What is saved (`toJSON`): the engine state, the draft, the side / level / seed, the moves list, the last action.
import * as E from "./shared/engine.js";
import * as B from "./shared/bots.js";
import { t } from "./i18n/zh-Hant.js";

const { CARD, SPACE, CCP, KMT } = E;
export const SAVE_VERSION = 1;
const MOVES_KEPT = 80;

const J = (x) => JSON.parse(JSON.stringify(x));
const cardName = (id) => (E.isAid(id) ? E.AID.find((a) => a.id === id).zh : CARD[id] ? CARD[id].zh : id);
const spaceName = (id) => (SPACE[id] ? SPACE[id].zh : id);
const uniq = (a) => [...new Set(a)];

// ---------- the bot ----------
// The generator for the n-th action of a game: pure in (seed, n).
export function botSeed(seed, n) { return (Math.imul(seed | 0, 2654435761) + Math.imul(n + 1, 40503) + 0x9e3779b9) >>> 0; }
// What a worker (or the page itself) runs: { side, view, level, rngSeed } -> the engine action, or null.
export function decideTask(task) {
  const a = B.decide(task.view, task.side, task.level, E.makeRng(task.rngSeed));
  if (!a) return null;
  const { game, why, ...rest } = a; // the bot's notes are not part of the move
  return rest;
}

// ---------- the 扶植 builder ----------
function validPoints(st, side, ops, points, card) {
  for (let i = 0; i < points.length; i++) if (!E.placeTargets(st, side, ops, points.slice(0, i), card).lit.has(points[i])) return false;
  return true;
}
// How many more of `id` a pending "points" choice can take: the checks of the engine's validateChoice.
function roomFor(st, p, id, counts) {
  let r = Infinity;
  if (p.distinct) r = Math.min(r, 1);
  if (p.maxPer) r = Math.min(r, p.maxPer);
  if (p.maxOf) r = Math.min(r, p.maxOf[id] ?? 0);
  if (p.side != null) r = Math.min(r, E.capOf(st, id) - E.pointsOf(st, p.side, id));
  return r - (counts[id] || 0);
}
const tally = (list) => list.reduce((m, id) => ((m[id] = (m[id] || 0) + 1), m), {});

// What an option of a pending decision is called.
function optionLabel(p, o) {
  if (o.label) return o.label;
  const id = String(o.id);
  if (p.tag === "siege") {
    const [kind, a, b] = id.split(":");
    if (kind === "hold") return t("opt.siege.hold");
    if (kind === "reinforce") return t("opt.siege.reinforce", { from: spaceName(a), k: b });
    if (kind === "breakout") return t("opt.siege.breakout", { to: spaceName(a) });
  }
  if (p.tag === "sweep" || p.tag === "realign") {
    const s = t(`opt.${p.tag}.${id}`); if (s !== `opt.${p.tag}.${id}`) return s;
  }
  if (SPACE[id]) return spaceName(id);
  if (CARD[id]) return cardName(id);
  const g = t(`opt.${id}`); if (g !== `opt.${id}`) return g;
  return id;
}

// ---------- the session ----------
class Session {
  constructor(data) {
    this.seed = data.seed; this.side = data.side; this.level = data.level;
    this.st = data.st; this.draft = data.draft || {}; this.moves = data.moves || []; this.last = data.last || null;
    this.ver = 0; this._memo = null;
  }

  // -- what the page reads
  view() { return E.view(this.st, this.side); }
  over() { return this.st.winner != null; }
  result() { return this.over() ? { winner: this.st.winner, reason: this.st.reason } : null; }
  lastAction() { return this.last ? J(this.last) : null; }
  // The moves since the human last acted (the page's "what the opponent just did"), oldest first.
  recent() {
    const out = [];
    for (let i = this.moves.length - 1; i >= 0 && this.moves[i].by === "bot"; i--) out.unshift(this.moves[i]);
    return out;
  }
  // "bot" while the bot has to act, "human" while the human has, "over" at the end.
  turnOf() {
    if (this.over()) return "over";
    const must = E.mustAct(this.st);
    return must.includes(this.side) && !must.some((s) => s !== this.side) ? "human" : must.length ? "bot" : "human";
  }
  // The question the human is answering now: { kind: "headline" | "action" | "pending", pending? }.
  mode() { const m = this._mode(); return m ? { kind: m.kind, legal: m.L, ...(m.p ? { pending: m.p } : {}) } : null; }
  choices() { return this._choiceList().map((c) => ({ ...c })); }
  // While a 扶植 is being built: { ops, spent, left, points } from E.placeTargets (the page shows "n points left"); else null.
  builder() {
    const m = this._mode(), d = this.draft;
    if (!m || (m.kind === "action" && !d.card)) return null;
    if (m.kind === "headline") return null;
    const eu = m.kind === "pending" ? (m.p.kind === "ops" ? d.use : null) : this._eu(d);
    if (eu !== "place") return null;
    const ctx = this._opsCtx(m, d), pts = d.points || [];
    const r = E.placeTargets(this.st, this.side, ctx.ops, pts, ctx.card);
    return { ops: ctx.ops, spent: r.spent, left: r.left, points: pts.slice() };
  }

  // -- the bot
  botTask() {
    if (this.over()) return null;
    const bot = E.mustAct(this.st).find((s) => s !== this.side);
    if (bot == null) return null;
    return { side: bot, view: E.view(this.st, bot), level: this.level, rngSeed: botSeed(this.seed, (this.st.actions || []).length) };
  }
  botApply(action) { this._apply(action, "bot"); return this; }
  runBots() {
    for (let guard = 0; ; guard++) {
      const task = this.botTask();
      if (!task) return this;
      if (guard > 5000) throw new Error("the bot does not stop");
      const a = decideTask(task);
      if (!a) throw new Error(`the bot has no action (turn ${this.st.turn}, phase ${this.st.phase})`);
      this.botApply(a);
    }
  }

  // -- the human
  tap(id, opts = {}) {
    const m = this._mode();
    if (!m) return this;
    const cs = this._choiceList();
    if (!cs.some((c) => c.id === id)) throw new Error(`not a choice now: ${id}`);
    const r = this._advance(m, this.draft, id);
    if (r.action) {
      this.last = J(r.action);
      this._apply(r.action, "human");
      if (opts.bots !== false) this.runBots();
    } else { this.draft = r.draft; this.ver++; }
    return this;
  }

  // The taps that make the engine action `action`, in order; null if this session cannot tap it out.
  tapsFor(action) {
    const m = this._mode();
    if (!m || !action) return null;
    const ids = Object.keys(this.draft).length ? ["cancel"] : [];
    const add = (id) => { ids.push(id); };
    if (m.kind === "headline") {
      if (action.type !== "headline") return null;
      add(`card:${action.card}`);
    } else if (m.kind === "action") {
      if (action.type !== "play") return null;
      add(`card:${action.card}`);
      const use = action.use;
      if (["event", "reform", "bog"].includes(use)) add(`use:${use}`);
      else if (["place", "campaign", "lobby"].includes(use)) {
        if (action.pair) { add("use:pair"); add(`pair:${action.pair}`); add(`puse:${use}`); }
        else { add(`use:${use}`); if (action.order) add(`order:${action.order}`); }
        if (action.order !== "eventFirst") this._payloadTaps(use, action, add);
      } else return null;
    } else {
      if (action.type !== "choose") return null;
      const p = m.p, ch = action.choice;
      if (p.kind === "option") add(`opt:${ch}`);
      else if (p.kind === "card") for (const c of ch || []) add(`pc:${c}`);
      else if (p.kind === "points") for (const id of ch || []) add(`pt+:${id}`);
      else if (p.kind === "ops" && ch) { add(`use:${ch.use}`); this._payloadTaps(ch.use, ch, add); }
      else return null;
    }
    add("confirm");
    // Dry run on a copy: every tap must be on offer when it is made, and only the last one sends.
    const probe = new Session({ seed: this.seed, side: this.side, level: this.level, st: this.st, draft: J(this.draft), moves: [] });
    try {
      for (let i = 0; i < ids.length; i++) {
        const mm = probe._mode();
        if (!probe._choiceList().some((c) => c.id === ids[i])) return null;
        const r = probe._advance(mm, probe.draft, ids[i]);
        if (r.action) return i === ids.length - 1 ? ids : null;
        probe.draft = r.draft; probe.ver++; probe._memo = null;
      }
    } catch { return null; }
    return null;
  }
  _payloadTaps(use, a, add) {
    if (use === "place") for (const id of a.points || []) add(`pt+:${id}`);
    else if (use === "campaign") { add(`tgt:${a.target}`); if (a.siege) add(`plan:${a.siege}`); }
    else if (use === "lobby") add(`tgt:${a.target}`);
  }

  toJSON() {
    return {
      v: SAVE_VERSION, rules: E.RULES_VERSION, seed: this.seed, side: this.side, level: this.level,
      st: this.st, draft: this.draft, moves: this.moves.slice(-MOVES_KEPT), last: this.last,
    };
  }

  // -- inside
  _apply(action, by) {
    const before = this.st;
    const after = E.apply(before, action);
    const seq = before.logSeq || 0;
    const rec = {
      n: (this.moves.length ? this.moves[this.moves.length - 1].n + 1 : 0), by, side: action.side, turn: before.turn,
      entries: after.log.filter((e) => e.i > seq), changes: infDiff(before.inf, after.inf),
      // A bot's action is not kept: its plan for an attack is face down until the table has been read.
      ...(by === "human" ? { action: J(action) } : {}),
    };
    this.moves.push(rec);
    if (this.moves.length > MOVES_KEPT * 2) this.moves.splice(0, this.moves.length - MOVES_KEPT);
    this.st = after; this.draft = {}; this.ver++; this._memo = null;
  }

  _mode() {
    if (this._memo && this._memo.ver === this.ver && this._memo.mode !== undefined) return this._memo.mode;
    let mode = null;
    if (!this.over() && E.mustAct(this.st).includes(this.side)) {
      const L = E.legal(this.st, this.side);
      if (L.kind === "pending") mode = { kind: "pending", p: L.pending, L };
      else if (L.kind === "headline") mode = { kind: "headline", L };
      else if (L.kind === "action") mode = { kind: "action", L };
    }
    this._memo = { ver: this.ver, mode };
    return mode;
  }

  _choiceList() {
    const memo = this._memo && this._memo.ver === this.ver ? this._memo : null;
    if (memo && memo.choices) return memo.choices;
    const m = this._mode();
    const cs = m ? this._build(m, this.draft) : [];
    this._memo.choices = cs;
    return cs;
  }

  // The context of the ops being built: how many, whose card, which uses have targets.
  _opsCtx(m, d) {
    const st = this.st, side = this.side;
    if (m.kind === "pending") {
      const p = m.p, o = p.options;
      return { ops: p.ops, card: p.card, place: p.allowed.includes("place") && o.placeOptions.length > 0, campaign: p.allowed.includes("campaign") ? o.campaignTargets : [], lobby: p.allowed.includes("lobby") ? o.lobbyTargets.map((x) => x.id) : [], enemy: false };
    }
    const L = m.L;
    if (d.aid) { const a = L.aid; return { ops: a.ops, card: a.id, place: !!a.place, campaign: a.campaign ? a.campaign.targets : [], lobby: a.lobby ? a.lobby.targets.map((x) => x.id) : [], enemy: false }; }
    const c = L.cards.find((x) => x.id === d.card), u = c.uses;
    const ops = d.use === "pair" && d.pair ? E.opsOf(st, side, d.pair) : (u.place || u.campaign || u.lobby || { ops: c.ops }).ops;
    return { ops, card: undefined, place: !!u.place, campaign: u.campaign ? u.campaign.targets : [], lobby: u.lobby ? u.lobby.targets.map((x) => x.id) : [], enemy: !!u.enemy && !(d.use === "pair"), c };
  }

  // The effective ops use of a draft (the paired card's use when pairing).
  _eu(d) { return d.use === "pair" ? d.puse : d.use; }

  // The payload of the ops being built, or null while it is incomplete.
  _payload(ctx, eu, d) {
    if (eu === "place") return d.points && d.points.length ? { points: d.points.slice() } : null;
    if (eu === "campaign") {
      if (!d.target) return null;
      if (E.siegeNeeded(this.st, this.side, d.target) && !d.siege) return null;
      return { target: d.target, ...(d.siege ? { siege: d.siege } : {}) };
    }
    if (eu === "lobby") return d.target ? { target: d.target } : null;
    return null;
  }

  // The action the draft makes, or null while it is incomplete.
  _complete(m, d) {
    const side = this.side;
    if (m.kind === "headline") return d.card ? { type: "headline", side, card: d.card } : null;
    if (m.kind === "pending") {
      const p = m.p;
      if (p.kind === "option") return d.sel != null ? { type: "choose", side, choice: d.sel } : null;
      if (p.kind === "card") { const n = (d.picks || []).length; return n >= (p.min ?? 1) && n <= (p.n ?? 1) ? { type: "choose", side, choice: (d.picks || []).slice() } : null; }
      if (p.kind === "points") { const n = (d.points || []).length; return n >= (p.min ?? 0) && n <= (p.n ?? p.min ?? 0) ? { type: "choose", side, choice: (d.points || []).slice() } : null; }
      if (p.kind === "ops") { const pl = d.use ? this._payload(null, d.use, d) : null; return pl ? { type: "choose", side, choice: { use: d.use, ...pl } } : null; }
      return null;
    }
    if (!d.card) return null;
    const card = d.card;
    if (["event", "reform", "bog"].includes(d.use)) return { type: "play", side, card, use: d.use };
    const eu = this._eu(d);
    if (!["place", "campaign", "lobby"].includes(eu)) return null;
    if (d.use === "pair") {
      if (!d.pair) return null;
      const pl = this._payload(null, eu, d);
      return pl ? { type: "play", side, card, use: eu, pair: d.pair, ...pl } : null;
    }
    const ctx = this._opsCtx(m, d);
    if (ctx.enemy) {
      if (!d.order) return null;
      if (d.order === "eventFirst") return { type: "play", side, card, use: eu, order: "eventFirst" };
      const pl = this._payload(ctx, eu, d);
      return pl ? { type: "play", side, card, use: eu, order: "opsFirst", ...pl } : null;
    }
    const pl = this._payload(ctx, eu, d);
    return pl ? { type: "play", side, card, use: eu, ...pl } : null;
  }

  // One tap on a draft: { draft } or { action }.
  _advance(m, d, id) {
    d = J(d);
    const [k, ...rest] = id.split(":"), arg = rest.join(":");
    if (id === "cancel") return { draft: {} };
    if (id === "confirm") { const a = this._complete(m, d); if (!a) throw new Error("confirm: nothing to send"); return { action: a }; }
    switch (k) {
      case "card":
        if (m.kind === "headline") return { draft: { card: arg } };
        return { draft: E.isAid(arg) ? { card: arg, aid: true } : { card: arg } };
      case "use": return { draft: { card: d.card, ...(d.aid ? { aid: true } : {}), use: arg } };
      case "pair": return { draft: { card: d.card, use: "pair", pair: arg } };
      case "puse": return { draft: { card: d.card, use: "pair", pair: d.pair, puse: arg } };
      case "order": return { draft: { ...d, order: arg, points: [], target: null, siege: null } };
      case "tgt": return { draft: { ...d, target: arg, siege: null } };
      case "plan": return { draft: { ...d, siege: arg } };
      case "opt": return { draft: { ...d, sel: arg } };
      case "pc": {
        const picks = (d.picks || []).slice(), i = picks.indexOf(arg);
        if (i >= 0) picks.splice(i, 1); else if ((m.p.n ?? 1) === 1) picks.splice(0, picks.length, arg); else picks.push(arg);
        return { draft: { ...d, picks } };
      }
      case "pt+": return { draft: { ...d, points: [...(d.points || []), arg] } };
      case "pt-": { const pts = (d.points || []).slice(), i = pts.lastIndexOf(arg); if (i >= 0) pts.splice(i, 1); return { draft: { ...d, points: pts } }; }
      default: throw new Error(`unknown tap ${id}`);
    }
  }

  // Everything on offer for this draft.
  _build(m, d) {
    const st = this.st, side = this.side, out = [];
    const push = (id, kind, label, extra) => out.push({ id, kind, label, ...extra });
    const cancel = () => push("cancel", "cancel", t("c.cancel"));
    const confirm = () => push("confirm", "confirm", t("c.confirm"));
    const complete = this._complete(m, d) != null;
    const started = Object.keys(d).length > 0;

    if (m.kind === "headline") {
      for (const c of m.L.cards) push(`card:${c}`, "card", cardName(c), { card: c, selected: d.card === c });
      if (complete) confirm();
      if (started) cancel();
      return out;
    }

    if (m.kind === "pending") {
      const p = m.p;
      if (p.kind === "option") {
        for (const o of p.options) push(`opt:${o.id}`, "option", optionLabel(p, o), { option: o.id, selected: d.sel === o.id });
      } else if (p.kind === "card") {
        const picks = d.picks || [], max = p.n ?? 1;
        for (const c of p.options) if (picks.includes(c) || picks.length < max || max === 1) push(`pc:${c}`, "pick", cardName(c), { card: c, selected: picks.includes(c) });
      } else if (p.kind === "points") {
        this._pointChoices(push, p, d);
      } else if (p.kind === "ops") {
        const ctx = this._opsCtx(m, d);
        for (const u of ["place", "campaign", "lobby"]) if (p.allowed.includes(u) && (u === "place" ? ctx.place : ctx[u].length)) push(`use:${u}`, "use", t(`use.${u}`), { use: u, selected: d.use === u });
        if (d.use) this._opsChoices(push, m, ctx, d.use, d);
      }
      if (complete) confirm();
      if (started) cancel();
      return out;
    }

    // an action round
    const L = m.L;
    if (L.bog && L.bog.length) {
      for (const c of L.bog) push(`card:${c}`, "card", cardName(c), { card: c, selected: d.card === c });
      if (d.card) push("use:bog", "use", t("use.bog"), { use: "bog", selected: d.use === "bog" });
      if (complete) confirm();
      if (started) cancel();
      return out;
    }
    for (const c of L.cards) push(`card:${c.id}`, "card", cardName(c.id), { card: c.id, selected: d.card === c.id && !d.aid });
    if (L.aid) push(`card:${L.aid.id}`, "card", cardName(L.aid.id), { card: L.aid.id, aid: true, selected: !!d.aid });
    if (d.card) {
      const uses = this._usesOf(m, d);
      for (const u of uses) push(`use:${u}`, "use", t(`use.${u}`), { use: u, selected: d.use === u });
      if (d.use === "pair") {
        const c = L.cards.find((x) => x.id === d.card);
        for (const pc of c.uses.pair) push(`pair:${pc}`, "pair", cardName(pc), { card: pc, selected: d.pair === pc });
        if (d.pair) for (const u of ["place", "campaign", "lobby"]) if (c.uses[u]) push(`puse:${u}`, "use", t(`use.${u}`), { use: u, selected: d.puse === u });
        if (d.pair && d.puse) this._opsChoices(push, m, this._opsCtx(m, d), d.puse, d);
      } else if (["place", "campaign", "lobby"].includes(d.use)) {
        const ctx = this._opsCtx(m, d);
        if (ctx.enemy) for (const o of ["opsFirst", "eventFirst"]) push(`order:${o}`, "order", t(`c.order.${o}`), { order: o, selected: d.order === o });
        if (!ctx.enemy || d.order === "opsFirst") this._opsChoices(push, m, ctx, d.use, d);
      }
    }
    if (complete) confirm();
    if (started) cancel();
    return out;
  }

  _usesOf(m, d) {
    const L = m.L;
    if (d.aid) { const a = L.aid; return ["place", "campaign", "lobby"].filter((u) => a[u]); }
    const c = L.cards.find((x) => x.id === d.card);
    if (!c) return [];
    const u = c.uses, out = ["event"];
    if (u.reform) out.push("reform");
    for (const k of ["place", "campaign", "lobby"]) if (u[k]) out.push(k);
    if (u.pair && u.pair.length && (u.place || u.campaign || u.lobby)) out.push("pair");
    return out;
  }

  // The targets / points of the ops use `eu`.
  _opsChoices(push, m, ctx, eu, d) {
    const st = this.st, side = this.side;
    if (eu === "place") {
      const pts = d.points || [];
      const { lit, costs } = E.placeTargets(st, side, ctx.ops, pts, ctx.card);
      const counts = tally(pts);
      for (const id of lit) push(`pt+:${id}`, "point+", t("c.plusPoint", { space: spaceName(id) }), { space: id, cost: costs[id], n: counts[id] || 0 });
      for (const id of uniq(pts)) {
        const rest = pts.slice(); rest.splice(pts.lastIndexOf(id), 1);
        if (validPoints(st, side, ctx.ops, rest, ctx.card)) push(`pt-:${id}`, "point-", t("c.minusPoint", { space: spaceName(id) }), { space: id, n: counts[id] });
      }
    } else if (eu === "campaign") {
      for (const id of ctx.campaign) push(`tgt:${id}`, "target", spaceName(id), { space: id, selected: d.target === id });
      if (d.target && E.siegeNeeded(st, side, d.target)) for (const pl of E.SIEGE_PLANS) push(`plan:${pl}`, "plan", t(`c.plan.${pl}`), { plan: pl, selected: d.siege === pl });
    } else if (eu === "lobby") {
      for (const id of ctx.lobby) push(`tgt:${id}`, "target", spaceName(id), { space: id, selected: d.target === id });
    }
  }

  _pointChoices(push, p, d) {
    const st = this.st, pts = d.points || [], max = p.n ?? p.min ?? 0, counts = tally(pts);
    if (pts.length < max) for (const id of uniq(p.options)) if (roomFor(st, p, id, counts) > 0) push(`pt+:${id}`, "point+", t("c.plusPoint", { space: spaceName(id) }), { space: id, n: counts[id] || 0 });
    for (const id of uniq(pts)) push(`pt-:${id}`, "point-", t("c.minusPoint", { space: spaceName(id) }), { space: id, n: counts[id] });
  }
}

// How the board changed: [[space, red, blue], ...] for the spaces whose points moved.
function infDiff(a, b) {
  const out = [];
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id] || [0, 0], y = b[id] || [0, 0];
    if (x[0] !== y[0] || x[1] !== y[1]) out.push([id, y[0] - x[0], y[1] - x[1]]);
  }
  return out;
}

// ---------- the doors ----------
export function createSession({ seed, side = CCP, level = "normal", options = {}, bots = true } = {}) {
  const sd = seed == null ? E.randomSeed() : seed;
  const s = new Session({ seed: sd, side, level, st: E.createGame(sd, options), moves: [] });
  if (bots) s.runBots();
  return s;
}
export function restoreSession(json, { bots = true } = {}) {
  const j = typeof json === "string" ? JSON.parse(json) : json;
  if (!j || j.v !== SAVE_VERSION || !j.st || j.st.turn == null) throw new Error("not a save of this version");
  if (j.rules !== E.RULES_VERSION) throw new Error(`the save is from rules ${j.rules}, these are ${E.RULES_VERSION}`);
  const s = new Session({ seed: j.seed, side: j.side, level: j.level, st: j.st, draft: j.draft || {}, moves: j.moves || [], last: j.last || null });
  if (bots) s.runBots();
  return s;
}
export { E };
