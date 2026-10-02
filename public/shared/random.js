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
  if (p.side != null) r = Math.min(r, E.capOf(st, id) - E.infOf(st, id)[p.side]);
  return r - (counts[id] || 0);
}

// A 扶植 of `ops`: one point at a time on a space `placeTargets` lights, until
// none is lit. `card` is the aid card's id when the ops are an aid card's.
export function randomPoints(st, side, ops, rng, card) {
  const points = [];
  for (;;) {
    const { lit } = E.placeTargets(st, side, ops, points, card);
    if (!lit.size) return points;
    points.push(pickOne([...lit], rng));
  }
}

// Free ops (an ops step that asks, or 馬歇爾調處's pair): one of the `allowed`
// uses that has a target now, then its target or points. null when none has.
export function randomOps(st, side, ops, allowed, rng, card) {
  const o = E.opsOptions(st, side, card);
  const has = { place: o.placeOptions.length > 0, campaign: o.campaignTargets.length > 0, lobby: o.lobbyTargets.length > 0 };
  const uses = allowed.filter((u) => has[u]);
  if (!uses.length) return null;
  const use = pickOne(uses, rng);
  if (use === "place") return { use, points: randomPoints(st, side, ops, rng, card) };
  if (use === "campaign") return { use, target: pickOne(o.campaignTargets, rng) };
  return { use, target: pickOne(o.lobbyTargets, rng).id };
}

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
    case "ops": return randomOps(st, p.who, p.ops, p.allowed, rng, p.card);
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
        if (u.campaign) opts.push(ordered("campaign", () => ({ target: pickOne(u.campaign.targets, rng) })));
        if (u.lobby) opts.push(ordered("lobby", () => ({ target: pickOne(u.lobby.targets, rng).id })));
        // 馬歇爾調處: the pair's ops, on the same targets as any card's (`legal` read them without a card).
        if (u.pair && u.pair.length && (u.place || u.campaign || u.lobby)) opts.push(() => {
          const pair = pickOne(u.pair, rng);
          const { use, ...rest } = randomOps(st, side, E.opsOf(st, side, pair), ["place", "campaign", "lobby"], rng);
          return play(use, { pair, ...rest });
        });
      }
      if (L.aid) {
        const a = L.aid, aid = (use, rest) => ({ type: "play", side, card: a.id, use, ...rest });
        if (a.place) opts.push(() => aid("place", { points: randomPoints(st, side, a.ops, rng, a.id) }));
        if (a.campaign) opts.push(() => aid("campaign", { target: pickOne(a.campaign.targets, rng) }));
        if (a.lobby) opts.push(() => aid("lobby", { target: pickOne(a.lobby.targets, rng).id }));
      }
      return opts.length ? pickOne(opts, rng)() : null;
    }
    default: return null;
  }
}
