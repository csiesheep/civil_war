#!/bin/sh
# #32: D off (the default rules) on the three seeds of #28, 1000 games each, normal vs normal, cell full;
# each compared with tuning/32/same.mjs against tuning/28/runs/default-s*.txt.state.json (must be SAME).
#   sh tuning/32/runoff.sh [jobs=28]      (run from the repo root; --resume picks up a batch that died)
JOBS=${1:-28}
R=tuning/32/runs
mkdir -p $R
for SEED in 1 20001 40001; do
  node tests/sim.js 1000 --cell=full --seed=$SEED --jobs=$JOBS --out=$R/off-s$SEED.txt --resume 2>/dev/null
  echo "batch off seed $SEED exit $?"
  node tuning/32/same.mjs $R/off-s$SEED.txt.state.json tuning/28/runs/default-s$SEED.txt.state.json
  echo "same off-s$SEED vs 28/default-s$SEED exit $?"
done
echo ALL-DONE
