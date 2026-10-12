#!/bin/sh
# #41: the worth probes (tuning/41/probe-run.mjs), 480 games each on seeds 41000.., with the free 佈線 on in every
# arm (cFreePlant 1: markers on the board in most games, so that every class is asked often enough) and a hand worth
# 0 (as #40's probe did, more markers go down). The base arm is the same with no lever; the bot's price of a lever
# is its arm minus the base, per class.
#   sh tuning/41/run-probes.sh [jobs=24]      (run from the repo root)
J=${1:-24}
CW='{"handReal":0}'
node tuning/41/probe-run.mjs base '{"cFreePlant":1}' 480 $J 41000 "$CW"
node tuning/41/probe-run.mjs leak1 '{"cFreePlant":1,"cLeakBonus":1}' 480 $J 41000 "$CW"
node tuning/41/probe-run.mjs defectAny '{"cFreePlant":1,"cDefectAny":true}' 480 $J 41000 "$CW"
node tuning/41/probe-run.mjs handHalf '{"cFreePlant":1,"cHandover":"half"}' 480 $J 41000 "$CW"
node tuning/41/probe-run.mjs leakTR '{"cFreePlant":1,"cLeakCapital":false}' 480 $J 41000 "$CW"
echo ALL-DONE
