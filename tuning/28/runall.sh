#!/bin/sh
# #28: the new default rules (B on, no variant) on the three seeds of #27, and `Boff`
# ({ mechanismB: false }) on seed 1; each compared with tuning/28/same.mjs against what it must equal.
#   sh tuning/28/runall.sh [jobs=28]      (run from the repo root; --resume picks up a batch that died)
JOBS=${1:-28}
R=tuning/28/runs
mkdir -p $R
for SEED in 1 20001 40001; do
  node tests/sim.js 1000 --cell=full --seed=$SEED --jobs=$JOBS --out=$R/default-s$SEED.txt --resume 2>/dev/null
  echo "batch default seed $SEED exit $?"
  node tuning/28/same.mjs $R/default-s$SEED.txt.state.json tuning/27/runs/B-s$SEED.txt.state.json
  echo "same default-s$SEED vs 27/B-s$SEED exit $?"
done
node tests/sim.js 1000 --cell=full --seed=1 --jobs=$JOBS --variant=Boff --out=$R/Boff-s1.txt --resume 2>/dev/null
echo "batch Boff seed 1 exit $?"
node tuning/28/same.mjs $R/Boff-s1.txt.state.json tuning/24/runs/default-s1.txt.state.json
echo "same Boff-s1 vs 24/default-s1 exit $?"
echo ALL-DONE
