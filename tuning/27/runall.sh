#!/bin/sh
# #27: the six batches of the report, one after another (each with the whole machine, so the seconds
# per game compare), B off and B on alternating per seed; then tests/targets.mjs on each state file.
#   sh tuning/27/runall.sh [jobs=28]      (run from the repo root; --resume picks up a batch that died)
JOBS=${1:-28}
for SEED in 1 20001 40001; do
  for V in off B; do
    OUT=tuning/27/runs/$V-s$SEED.txt
    if [ "$V" = B ]; then VAR=--variant=B; else VAR=; fi
    node tests/sim.js 1000 --cell=full --seed=$SEED --jobs=$JOBS $VAR --out=$OUT --resume 2>/dev/null
    echo "batch $V seed $SEED exit $?"
    node tests/targets.mjs $OUT.state.json > tuning/27/runs/$V-s$SEED.targets.txt
    echo "targets $V seed $SEED exit $?"
  done
done
echo ALL-DONE
