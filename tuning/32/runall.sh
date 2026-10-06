#!/bin/sh
# #32: the six batches of the report. D off (the default rules) and D on (variant D, { mechanismD: true }),
# seeds 1 / 20001 / 40001, 1000 games each, normal vs normal, cell full. The two batches of a seed run side by
# side (half the jobs each), so their seconds per game are read on the same machine load.
# D off is compared with tuning/32/same.mjs against tuning/28/runs/default-s*.txt.state.json (must be SAME);
# every state file then goes through tests/targets.mjs.
#   sh tuning/32/runall.sh [jobs=28]      (run from the repo root; --resume picks up a batch that died)
JOBS=${1:-28}
HALF=$((JOBS / 2))
R=tuning/32/runs
mkdir -p $R
for SEED in 1 20001 40001; do
  node tests/sim.js 1000 --cell=full --seed=$SEED --jobs=$HALF --out=$R/Doff-s$SEED.txt --resume 2>/dev/null &
  node tests/sim.js 1000 --cell=full --seed=$SEED --jobs=$HALF --variant=D --out=$R/Don-s$SEED.txt --resume 2>/dev/null &
  wait
  echo "batches seed $SEED done"
  node tuning/32/same.mjs $R/Doff-s$SEED.txt.state.json tuning/28/runs/default-s$SEED.txt.state.json
  echo "same Doff-s$SEED vs 28/default-s$SEED exit $?"
done
for F in $R/Doff-s*.txt.state.json $R/Don-s*.txt.state.json; do
  node tests/targets.mjs $F > $F.targets.txt 2>&1
  echo "targets $F exit $? $(grep '^TARGETS' $F.targets.txt)"
done
echo ALL-DONE
