#!/bin/sh
# #40 round 3: the three C-on batches of tuning/40/runall.sh again (the 佈線 changed, orchestrator 裁決 #40 round 3;
# C off is unchanged, its batches stand). Same seeds, same flags, targets on each.
#   sh tuning/40/runC.sh [jobs=28]      (run from the repo root)
JOBS=${1:-28}
R=tuning/40/runs
for SEED in 1 20001 40001; do
  node tests/sim.js 1000 --cell=full --seed=$SEED --jobs=$JOBS --variant=C --out=$R/C-s$SEED.txt --resume 2>/dev/null
  echo "batch C seed $SEED exit $?"
  node tests/targets.mjs $R/C-s$SEED.txt.state.json > $R/C-s$SEED.targets.txt 2>&1
  echo "targets C-s$SEED exit $?"
done
echo ALL-DONE
