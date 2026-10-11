#!/bin/sh
# #40: section 四 1 of the brief, one defect at a time on the product, each restored (git checkout) before the next:
# B8 at BOTS_SCALE=0.25 (its rigs are not scaled; its 20-game checks become 5 games, so they say less here).
#   sh tuning/40/falsify.sh   (from the repo root, on a clean tree; the logs in tuning/40/runs/falsify/)
set -u
O=tuning/40/runs/falsify
mkdir -p $O
if [ -n "$(git status --porcelain public/shared)" ]; then echo "public/shared is not clean"; exit 1; fi
ONLY=${1:-}
one() { # name file sed-expression  (sh tuning/40/falsify.sh <letter> runs only that one)
  case "$1" in "$ONLY"*) ;; *) [ -n "$ONLY" ] && return 0 ;; esac
  sed -i "$3" "$2"
  if git diff --quiet -- "$2"; then echo "$1: the pattern did not hit"; exit 1; fi
  BOTS_SCALE=0.25 node --test tests/bots.test.js > $O/$1.log 2>&1
  git checkout -- "$2"
  echo "== $1"; grep -E "BOTS-VERDICT|^(失敗|尚未實作) · B8" $O/$1.log | cut -c1-420
}
# (a) moleBelief always the prior: the "no"s change nothing (the likelihood is never applied).
one a-belief-prior public/shared/bots.js 's/for (const e of ev) if (e.idx.some((i) => k\[i\] > 0)) wt \*= e.q;/for (const e of ev) if (false \&\& e.idx.some((i) => k[i] > 0)) wt *= e.q; \/\/ FALSIFY/'
# (b) the prior with 10 for its denominator: hand markers made up to ten in all.
one b-prior-over-10 public/shared/bots.js 's/const m = view.moles, tr = moleTrack(view), gs = tr.groups, h = m.handCount || 0, f = tr.knownFake;/const m = view.moles, tr = moleTrack(view), gs = tr.groups, h = 10 - tr.groups.reduce((s, g) => s + g.n, 0), f = tr.knownFake; \/\/ FALSIFY/'
# (c) purgeValue blind to the belief: the view's "no"s taken out before the posterior is read.
one c-purge-ignores-belief public/shared/bots.js '/^export function purgeValue/,/^}/ s/^  const post = molePosterior(view);$/  const post = molePosterior({ ...view, log: (view.log || []).filter((l) => l.type !== "moleNo") }); \/\/ FALSIFY/'
# (d) the engine does not log the "no" (orchestrator 裁決 #40, 2: the public entry): the belief has nothing to read.
one d-no-moleNo-entry public/shared/engine.js 's/    } else moleNo(st, "leak", T, leakCities(st, T, step.response));/    } \/\/ FALSIFY/'
echo FALSIFY-DONE
