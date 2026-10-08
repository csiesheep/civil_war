#!/bin/sh
# #36: the six batches of the report. E off (the default rules) and E on (variant E, { mechanismE: true }),
# seeds 1 / 20001 / 40001, 1000 games each, normal vs normal, cell full. The two batches of a seed run side by
# side (half the jobs each), so their seconds per game are read on the same machine load.
# E off is compared with tuning/28/same.mjs against tuning/28/runs/default-s*.txt.state.json (must be SAME:
# every leaf of cells.full.sum with keys sorted, the error count; ms and done not compared); every state file
# then goes through tests/targets.mjs.
#   sh tuning/36/runall.sh [jobs=28]      (run from the repo root; --resume picks up a batch that died)
JOBS=${1:-28}
HALF=$((JOBS / 2))
R=tuning/36/runs
mkdir -p $R
for SEED in 1 20001 40001; do
  node tests/sim.js 1000 --cell=full --seed=$SEED --jobs=$HALF --out=$R/Eoff-s$SEED.txt --resume 2>/dev/null &
  node tests/sim.js 1000 --cell=full --seed=$SEED --jobs=$HALF --variant=E --out=$R/Eon-s$SEED.txt --resume 2>/dev/null &
  wait
  echo "batches seed $SEED done"
  node tuning/28/same.mjs $R/Eoff-s$SEED.txt.state.json tuning/28/runs/default-s$SEED.txt.state.json
  echo "same Eoff-s$SEED vs 28/default-s$SEED exit $?"
done
for F in $R/Eoff-s*.txt.state.json $R/Eon-s*.txt.state.json; do
  node tests/targets.mjs $F > $F.targets.txt 2>&1
  echo "targets $F exit $? $(grep '^TARGETS' $F.targets.txt)"
done
echo ALL-DONE
