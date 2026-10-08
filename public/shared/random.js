// The random player (#9): a random LEGAL action for whoever must act. The
// "easy" level of the bots (bots.js re-exports these four) and the player of
// the fuzz (tests/driver.js, tests/fuzz.test.js).
//
// Every action is built only from what the engine itself offers, never by
// trying actions until one is accepted: `legal(st, side)` for the action round
// and the headline, `placeTargets(st, side, ops, points, card)` point by point
// for a 扶植 (reach, cost, cap, supply, 受降, 戰略反攻's jump, 蘇援's +1 and
// 美援's airlift are all read there), `opsOptions` for the targets of free
// ops, and a pending decision's own `options` / `n` / `min` / `distinct` /
// `maxPer` / `maxOf` / `side` (the cap) for its answer. So an action the engine
// refuses is a disagreement between what it offers and what it accepts, which
// is what the fuzz is there to find.
//
// Mechanism B (#26, option `mechanismB`; the default rules since #28): an attack on a city that must name a
// plan names one at random (`attack` below); its other decisions (固守 / 增援 /
// 突圍, the −1 / +1, 守 / 撤 and where to 撤) are pending choices like any other.
//
// Mechanism D (#31, option `mechanismD`): 政工 is one more use of a card (`legal().cards[].uses.politics`,
// and "politics" in an ops ask's `allowed`), its target drawn from the engine's `politicsOptions`;
// the Nationalists' 先移藍 / 先移灰 (tag "grayOrder") is a pending option like any other.
//
// Mechanism E (#35, option `mechanismE`): 印鈔 is one more candidate for each of the Nationalists' cards
// (`uses.print`), 激進 one more 扶植 for the Communists (`legal().radical`, the village its first point),
// 平抑 one more play of 美援 (`legal().peg`); an ops ask offers both by its `canPrint` / `radical`; the
// 還鄉團 (tag "returnHome") is a pending points choice like any other. None of these keys exists without
// the option, so a game without it draws exactly what it drew.
//
// It reads the whole state (the opponent's hand included); playing from a
// per-seat `view()` is M2's. Its only source of chance is the `rng` it is
// given (`E.makeRng`'s, with `int(n)`), so a game of random players is fixed
// by its seeds.
import * as E from "./engine.js";

const { CARD } = E;
const pickOne = (arr, rng) => arr[rng.int(arr.length)];
// How many more of `id` a points choice can take with `counts` already in it:
// the checks of the engine's `validateChoice`, in its order.
function roomFor(st, p, id, counts) {
  let r = Infinity;
  if (p.distinct) r = Math.min(r, 1);
  if (p.maxPer) r = Math.min(r, p.maxPer);
  if (p.maxOf) r = Math.min(r, p.maxOf[id] ?? 0);
  if (p.side != null) r = Math.min(r, E.capOf(st, id) - E.pointsOf(st, p.side, id));
  return r - (counts[id] || 0);
}

// A 扶植 of `ops`: one point at a time on a space `placeTargets` lights, until
// none is lit. `card` is the aid card's id when the ops are an aid card's.
// `radical` (#35, mechanism E): the village of a 激進, its first point (the caller has
// checked that `placeTargets` lights it); the rest are read with its points there as the engine places them.
export function randomPoints(st, side, ops, rng, card, radical) {
  const points = radical != null ? [radical] : [];
  for (;;) {
    const { lit } = E.placeTargets(st, side, ops, points, card, radical);
    if (!lit.size) return points;
    points.push(pickOne([...lit], rng));
  }
}

// Mechanism E (#35, option `mechanismE`): the villages a 激進 may name that a 扶植 of `ops` (with
// `card`, an aid card's id or absent) can reach with its first point. Draws nothing.
function radicalLit(st, side, ops, villages, card) {
  if (!villages || !villages.length) return [];
  const { lit } = E.placeTargets(st, side, ops, [], card);
  return villages.filter((v) => lit.has(v));
}
const PRINT_USES = ["place", "campaign", "politics"];

// A 奇襲's target, and under mechanism B (#26) the plan an attack on a city
// must name (`E.siegeNeeded`): 打點 or 打援, at random. Without the option no
// plan is drawn, so a game of the default rules draws exactly what it drew.
function attack(st, side, targets, rng) {
  const target = pickOne(targets, rng);
  return E.siegeNeeded(st, side, target) ? { target, siege: pickOne(E.SIEGE_PLANS, rng) } : { target };
}

// Free ops (an ops step that asks, or 馬歇爾調處's pair): one of the `allowed`
// uses that has a target now, then its target or points. null when none has.
export function randomOps(st, side, ops, allowed, rng, card) {
  const o = E.opsOptions(st, side, card);
  const has = { place: o.placeOptions.length > 0, campaign: o.campaignTargets.length > 0, lobby: o.lobbyTargets.length > 0 };
  // Mechanism D (#31): 政工 is offered only when the ops ask allows it (never without the option).
  const pol = allowed.includes("politics") ? E.politicsOptions(st, side, ops) : [];
  if (pol.length) has.politics = true;
  const uses = allowed.filter((u) => has[u]);
  if (!uses.length) return null;
  const use = pickOne(uses, rng);
  if (use === "place") return { use, points: randomPoints(st, side, ops, rng, card) };
  if (use === "campaign") return { use, ...attack(st, side, o.campaignTargets, rng) };
  if (use === "politics") return { use, ...politicsPayload(side, pickOne(pol, rng)) };
  return { use, target: pickOne(o.lobbyTargets, rng).id };
}
// 政工's payload (#31): the Nationalists name a space (整編), the Communists a power (統戰).
const politicsPayload = (side, id) => (side === E.KMT ? { target: id } : { power: id });

// An answer to the pending decision `p`, whatever its kind.
export function randomChoice(st, p, rng) {
  switch (p.kind) {
    case "points": {
      const min = p.min ?? 0, max = p.n ?? min;
      const n = min + (max > min ? rng.int(max - min + 1) : 0);
      const counts = {}, out = [];
      for (let i = 0; i < n; i++) {
        const cands = p.options.filter((id) => roomFor(st, p, id, counts) > 0);
        if (!cands.length) break;
        const id = pickOne(cands, rng);
        counts[id] = (counts[id] || 0) + 1;
        out.push(id);
      }
      return out;
    }
    case "card": {
      const min = p.min ?? 1, max = p.n ?? 1;
      const n = min + (max > min ? rng.int(max - min + 1) : 0);
      const pool = p.options.slice(), out = [];
      while (out.length < n && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
      return out;
    }
    case "option": return pickOne(p.options, rng).id;
    case "ops": {
      // Mechanism E (#35): the ask says whether these ops may be printed (`canPrint`) and where a
      // 激進 may go (`radical`); either is taken half the time it is possible. Neither key exists
      // without the option, so nothing more is drawn then.
      if (p.canPrint && rng.int(2)) {
        const o = randomOps(st, p.who, p.ops + E.E_SPEC.print, p.allowed.filter((u) => PRINT_USES.includes(u)), rng, p.card);
        if (o) return { ...o, print: true };
      }
      if (p.radical && p.allowed.includes("place")) {
        const vs = radicalLit(st, p.who, p.ops, p.radical);
        if (vs.length && rng.int(2)) {
          const v = pickOne(vs, rng);
          return { use: "place", points: randomPoints(st, p.who, p.ops, rng, undefined, v), radical: v };
        }
      }
      return randomOps(st, p.who, p.ops, p.allowed, rng, p.card);
    }
    default: throw new Error(`randomChoice: unknown kind ${p.kind}`);
  }
}

// A random legal action for `side`, or null when `side` has nothing to do.
// In an action round, a scoring card in hand is played first: keeping one to
// the turn's end loses the game there (legal, but then nothing past turn 1
// would ever be played). Otherwise every legal play is one candidate and one
// is drawn: each card as its event, 變法, 扶植, 奇襲 and 遊說 (an enemy card's
// ops with its event first or after), 馬歇爾調處 with a pair, and the aid card's
// 扶植 / 奇襲 / 遊說.
export function randomAction(st, side, rng) {
  const L = E.legal(st, side);
  switch (L.kind) {
    case "pending": return { type: "choose", side, choice: randomChoice(st, L.pending, rng) };
    case "headline": return L.cards.length ? { type: "headline", side, card: pickOne(L.cards, rng) } : null;
    case "action": {
      if (L.bog && L.bog.length) return { type: "play", side, card: pickOne(L.bog, rng), use: "bog" };
      const scoring = L.cards.find((c) => CARD[c.id].scoring);
      if (scoring) return { type: "play", side, card: scoring.id, use: "event" };
      const opts = [];
      for (const c of L.cards) {
        const u = c.uses, play = (use, rest) => ({ type: "play", side, card: c.id, use, ...rest });
        // An enemy card's ops need an order; event first, its ops are asked for after the event.
        const ordered = (use, payload) => () => {
          if (!u.enemy) return play(use, payload());
          return rng.int(2) ? play(use, { order: "eventFirst" }) : play(use, { order: "opsFirst", ...payload() });
        };
        opts.push(() => play("event"));
        if (u.reform) opts.push(() => play("reform"));
        if (u.place) opts.push(ordered("place", () => ({ points: randomPoints(st, side, u.place.ops, rng) })));
        if (u.campaign) opts.push(ordered("campaign", () => attack(st, side, u.campaign.targets, rng)));
        if (u.lobby) opts.push(ordered("lobby", () => ({ target: pickOne(u.lobby.targets, rng).id })));
        // 政工 (#31): `uses.politics` exists only under mechanism D.
        if (u.politics) opts.push(ordered("politics", () => politicsPayload(side, pickOne(u.politics.targets, rng))));
        // 馬歇爾調處: the pair's ops, on the same targets as any card's (`legal` read them without a card).
        if (u.pair && u.pair.length && (u.place || u.campaign || u.lobby)) opts.push(() => {
          const pair = pickOne(u.pair, rng);
          const { use, ...rest } = randomOps(st, side, E.opsOf(st, side, pair), ["place", "campaign", "lobby"], rng);
          return play(use, { pair, ...rest });
        });
        // Mechanism E (#35): `uses.print` and `L.radical` exist only under the option.
        // 印鈔: the card's ops +2 on 扶植, an attack or 政工 (an enemy card's ops first; with its event
        // first the print is asked with the ops, `randomChoice`), and 馬歇爾調處's pair the same way.
        if (u.print) {
          const ok = PRINT_USES.filter((x) => u[x]);
          if (ok.length) opts.push(() => {
            const use = pickOne(ok, rng), ops = u[use].ops + E.E_SPEC.print, order = u.enemy ? { order: "opsFirst" } : {};
            if (use === "place") return play("place", { ...order, points: randomPoints(st, side, ops, rng), print: true });
            if (use === "campaign") return play("campaign", { ...order, ...attack(st, side, u.campaign.targets, rng), print: true });
            return play("politics", { ...order, ...politicsPayload(side, pickOne(u.politics.targets, rng)), print: true });
          });
          if (u.pair && u.pair.length && (u.place || u.campaign)) opts.push(() => {
            const pair = pickOne(u.pair, rng);
            const { use, ...rest } = randomOps(st, side, E.opsOf(st, side, pair) + E.E_SPEC.print, ["place", "campaign"], rng);
            return play(use, { pair, ...rest, print: true });
          });
        }
        // 激進土改: a 扶植 whose first point is a village of `L.radical` it can reach.
        if (u.place && L.radical && L.radical.length) {
          const vs = radicalLit(st, side, u.place.ops, L.radical);
          if (vs.length) opts.push(() => {
            const v = pickOne(vs, rng);
            return play("place", { ...(u.enemy ? { order: "opsFirst" } : {}), points: randomPoints(st, side, u.place.ops, rng, undefined, v), radical: v });
          });
        }
      }
      if (L.aid) {
        const a = L.aid, aid = (use, rest) => ({ type: "play", side, card: a.id, use, ...rest });
        if (a.place) opts.push(() => aid("place", { points: randomPoints(st, side, a.ops, rng, a.id) }));
        if (a.campaign) opts.push(() => aid("campaign", attack(st, side, a.campaign.targets, rng)));
        if (a.lobby) opts.push(() => aid("lobby", { target: pickOne(a.lobby.targets, rng).id }));
        // Mechanism E (#35): 蘇援's 扶植 may be a 激進 too.
        if (a.place && L.radical && L.radical.length) {
          const vs = radicalLit(st, side, a.ops, L.radical, a.id);
          if (vs.length) opts.push(() => { const v = pickOne(vs, rng); return aid("place", { points: randomPoints(st, side, a.ops, rng, a.id, v), radical: v }); });
        }
      }
      // Mechanism E (#35): 平抑, 美援 as a whole card (`L.peg` exists only under the option).
      if (L.peg) opts.push(() => ({ type: "play", side, card: "american_aid", use: "peg" }));
      return opts.length ? pickOne(opts, rng)() : null;
    }
    default: return null;
  }
}
