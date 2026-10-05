# 國共內戰 1945-1949 · China Civil War 1945-1949

A two-player card-driven strategy game on the Chinese Civil War, 1945 to 1949. The Communists (先手) cut the lines and isolate the cities; the Nationalists hold a network that gets thinner every turn while their foreign support runs down. Eight turns, about an hour. Solo against a bot, or an online room with a four-letter code. English and Traditional Chinese.

A free fan project, unofficial. The card-driven play is inspired by *Twilight Struggle* (Ananda Gupta and Jason Matthews, GMT Games); rules and mechanics are not copyrightable, and nothing of that game's name, art or text is used. Not affiliated with GMT Games or with any published game on the same subject.

Will live at https://games.csiesheep.com/civil_war/ (a `noindex` placeholder for now).

## Status: the batch-1 engine is done (M1), the bots are delivered (M2); the screen (M3) has not started

The rules engine for the first batch is written. There is no screen yet. What exists:

- the map (29 spaces: 17 cities, 12 villages) and the 72 cards, **every card with its event**;
- supply, the eight situation cards (時局) with a hand size and action rounds that differ by era and by side, and the two support tracks (American and Soviet);
- American Aid and Soviet Aid (these replace Zongheng's Nine Cauldrons), the American garrison, and base-area scoring;
- the guard, `node --test tests/acceptance.test.js`: 165 checks pass, none is pending; its constants are copied from the rulebook, not read from the engine;
- a random-play fuzz, `node --test tests/fuzz.test.js`, which passes: it plays 2,000 random legal games; every game ends with no error, every tenth game replays identically from its seed, and all 67 events get resolved;
- the bots, `public/shared/bots.js` (levels easy, normal, hard; easy is the random player), and the bot-vs-bot harness `tests/sim.js`;
- the random player, `public/shared/random.js` (`randomAction`, `randomPoints`, `randomOps`, `randomChoice`), which the fuzz uses; `bots.js` re-exports those four from it.

Not there yet: the client (M3).

The year on each event card and the facts quoted in the rules were checked against sources in issue #10: none of the 58 card years was found wrong, but many rest on a weak second source (and the troop-strength figures on Chinese-Communist-side sources only), so they should be checked again against print sources before the numbers are printed for players.

The rules are in the owner's vault: `Projects/civil_war/civil_war - rulebook.md` (batch 1), `civil_war plan.md` (decisions, milestones), `civil_war - mechanisms.md` (the mechanisms still to come).

## Where the code comes from

`public/shared/engine.js`, `public/shared/bots.js`, `tests/driver.js` and `tests/sim.js` were copied from the sibling game [Zongheng](https://github.com/csiesheep/zongheng) at commit `686b439`, without its git history. The second commit of this repo is that copy, byte for byte except for line endings; the third is a mechanical rename (the seats `QIN`/`CHU` became `CCP`/`KMT`); everything after that is this game's own. So `git diff <second commit> -- public/shared/engine.js` shows exactly what was changed.

Much of the copied engine still speaks Zongheng: its comments cite Zongheng's issue numbers, and these names are kept until the rules behind them are rewritten:

| in the code | in this game |
|---|---|
| `mie` | 易幟 (a regional power changes flags; 3 win it for the Communists) |
| `seals` | 整編 (a power integrated; 5 win it for the Nationalists) |
| `mandate` | 民心 (Popular Support; the Communists win at +20, the Nationalists at −15, the Communists from turn 7 and the Nationalists from turn 6; before that turn the lead is held at +19 for the Communists and −3 for the Nationalists: `MANDATE_WIN`, `MANDATE_FROM`, `MANDATE_CAP`) |
| `weariness` | 民生 (Livelihood) |
| `reform` | 建軍 / 行憲 |
| `campaign`, `lobby` | 進攻 (奇襲), 策反 (遊說) |
| `AID` | 美援 and 蘇援, which replaced Zongheng's `jiuding` (Nine Cauldrons; gone from the engine) |
| `STATES` | the five regional powers |

`bots.js` (M2, #12) and `tests/sim.js` (the bot-vs-bot harness, #15) have been rewritten for this game and run; `tests/bots.test.js` and `tests/sim.test.js` guard them.


## Develop

```bash
npm install
npm test                 # node --test: the guard and the fuzz (the fuzz takes about a minute)
node --test tests/acceptance.test.js   # the guard alone
npm run dev              # http://localhost:8787/civil_war/
```

The guard prints one line per check (通過 / 失敗 / 尚未實作) and a `VERDICT` line; anything under 失敗 fails the test.

## Deploy

```bash
npm run deploy
```

From a logged-in `wrangler`. Who deploys and when is in `TEAM.md`. Pushes to `main` do not deploy on their own.

## Milestones

| | |
|---|---|
| M0 | Phase 0: repo, placeholder live, `TEAM.md`, a first guard seen red |
| M1 | the batch-1 engine: supply, the fixed situation card per turn, foreign support, 72 card events, a test per rule — **done** (owner, #11) |
| M2 | bots and the bot-vs-bot harness; the first numbers; a stop-or-go decision — **delivered**; the decision was to adjust the rules first (#18), which ended in the rule set P10 (#23), now the default (#24) |
| M2b… | mechanism batches (siege choice, power attitudes, …), each a loop of engine, bots, numbers |
| M3 | the solo client |
| M4 | rooms |
| M5 | ship |
