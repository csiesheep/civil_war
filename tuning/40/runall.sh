#!/bin/sh
# #40: section 五 of the brief. C off (the default rules, no variant) and C on (`--variant=C`, { mechanismC: true }),
# seeds 1 / 20001 / 40001 × 1000, normal vs normal, cell full. Each C-off batch is compared with tuning/28/same.mjs
# against #28's (C off must be the same games: tuning/28/runs/default-s*.txt.state.json); every batch gets
# tests/targets.mjs. The two arms of a seed run one after the other, each with all the jobs (the same load).
#   sh tuning/40/runall.sh [jobs=28]      (run from the repo root; --resume picks up a batch that died)
JOBS=${1:-28}
R=tuning/40/runs
mkdir -p $R
for SEED in 1 20001 40001; do
  node tests/sim.js 1000 --cell=full --seed=$SEED --jobs=$JOBS --out=$R/off-s$SEED.txt --resume 2>/dev/null
  echo "batch off seed $SEED exit $?"
  node tuning/28/same.mjs $R/off-s$SEED.txt.state.json tuning/28/runs/default-s$SEED.txt.state.json
  echo "same off-s$SEED vs 28/default-s$SEED exit $?"
  node tests/targets.mjs $R/off-s$SEED.txt.state.json > $R/off-s$SEED.targets.txt 2>&1
  echo "targets off-s$SEED exit $?"
  node tests/sim.js 1000 --cell=full --seed=$SEED --jobs=$JOBS --variant=C --out=$R/C-s$SEED.txt --resume 2>/dev/null
  echo "batch C seed $SEED exit $?"
  node tests/targets.mjs $R/C-s$SEED.txt.state.json > $R/C-s$SEED.targets.txt 2>&1
  echo "targets C-s$SEED exit $?"
done
echo ALL-DONE
