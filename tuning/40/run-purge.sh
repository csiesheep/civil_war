#!/bin/sh
# #40: tuning/40/probe-purge.mjs on 120 games (seeds 9000..9119) in 24 processes of 5 games.
#   sh tuning/40/run-purge.sh      (from the repo root; the outputs in tuning/40/runs/purge/)
mkdir -p tuning/40/runs/purge
for a in $(seq 0 23); do node tuning/40/probe-purge.mjs $((9000 + a * 5)) 5 > tuning/40/runs/purge/natural-$a.txt 2>&1 & done
wait
echo PURGE-DONE
