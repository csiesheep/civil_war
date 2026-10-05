#!/bin/sh
# #27: B off and B on side by side, at the same time and with the same number of jobs each, so the
# seconds per game compare under one load (the six batches of runall.sh ran one after another while the
# machine's load changed); also the first 孤城 at a turn's end (`more.firstIsolatedEnd`).
#   sh tuning/27/runpair.sh [games=1000] [jobs each=14]      (from the repo root)
GAMES=${1:-1000}
JOBS=${2:-14}
node tests/sim.js $GAMES --cell=full --seed=1 --jobs=$JOBS --out=tuning/27/runs/pair-off-s1.txt --resume 2>/dev/null &
node tests/sim.js $GAMES --cell=full --seed=1 --jobs=$JOBS --variant=B --out=tuning/27/runs/pair-B-s1.txt --resume 2>/dev/null &
wait
echo PAIR-DONE
