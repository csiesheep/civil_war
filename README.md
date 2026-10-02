# 國共內戰 1945-1949 · China Civil War 1945-1949

A two-player card-driven strategy game on the Chinese Civil War, 1945 to 1949. The Communists (先手) cut the lines and isolate the cities; the Nationalists hold a network that gets thinner every turn while their foreign support runs down. Eight turns, about an hour. Solo against a bot, or an online room with a four-letter code. English and Traditional Chinese.

A free fan project, unofficial. The card-driven play is inspired by *Twilight Struggle* (Ananda Gupta and Jason Matthews, GMT Games); rules and mechanics are not copyrightable, and nothing of that game's name, art or text is used. Not affiliated with GMT Games or with any published game on the same subject.

Will live at https://games.csiesheep.com/civil_war/ (a `noindex` placeholder for now).

## Status: Phase 0

No game yet. What exists:

- the Worker and the placeholder page;
- the map (29 spaces: 17 cities, 12 villages) and the 72 cards **as data** (no card event is implemented);
- an engine that can set a game up and say what each side may do first;
- the first guard, `tests/acceptance.js`, with its constants copied from the rulebook.

The rules are in the owner's vault: `Projects/civil_war/civil_war - rulebook.md` (batch 1), `civil_war plan.md` (decisions, milestones), `civil_war - mechanisms.md` (the mechanisms still to come).

## Where the code comes from

`public/shared/engine.js`, `public/shared/bots.js`, `tests/driver.js` and `tests/sim.js` were copied from the sibling game [Zongheng](https://github.com/csiesheep/zongheng) at commit `686b439`, without its git history. The second commit of this repo is that copy, byte for byte except for line endings; the third is a mechanical rename (the seats `QIN`/`CHU` became `CCP`/`KMT`); everything after that is this game's own. So `git diff <second commit> -- public/shared/engine.js` shows exactly what was changed.

Much of the copied engine still speaks Zongheng: its comments cite Zongheng's issue numbers, and these names are kept until the rules behind them are rewritten:

| in the code | in this game |
|---|---|
| `mie` | 易幟 (a regional power changes flags; 3 win it for the Communists) |
| `seals` | 整編 (a power integrated; 5 win it for the Nationalists) |
| `mandate` | 民心 (Popular Support, ±20) |
| `weariness` | 民生 (Livelihood) |
| `reform` | 建軍 / 行憲 |
| `campaign`, `lobby` | 進攻 (奇襲), 策反 (遊說) |
| `jiuding` | 外援; to be split into American Aid and Soviet Aid |
| `STATES` | the five regional powers |

`bots.js` and `tests/sim.js` are **not adapted yet** and are not expected to run (M2).

## Develop

```bash
npm install
npm test                 # the first guard, as a node test
npm run dev              # http://localhost:8787/civil_war/
```

The guard as a page: serve the repo root (`bash tools/orch.sh serve .`) and open `tests/index.html`, or `tests/index.html?json=1` for the machine-readable verdict.

## Deploy

```bash
npm run deploy
```

From a logged-in `wrangler`. Who deploys and when is in `TEAM.md`. Pushes to `main` do not deploy on their own.

## Milestones

| | |
|---|---|
| M0 | Phase 0: repo, placeholder live, `TEAM.md`, a first guard seen red |
| M1 | the batch-1 engine: supply, the fixed situation card per turn, foreign support, 72 card events, a test per rule |
| M2 | bots and the bot-vs-bot harness; the first numbers; a stop-or-go decision |
| M2b… | mechanism batches (siege choice, power attitudes, …), each a loop of engine, bots, numbers |
| M3 | the solo client |
| M4 | rooms |
| M5 | ship |
