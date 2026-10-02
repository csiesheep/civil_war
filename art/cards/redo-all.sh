#!/bin/sh
# Runs the whole redo batch and retries once for anything that failed (render-redo.mjs skips files that exist).
cd "$(dirname "$0")/../.." || exit 1
node art/cards/render-redo.mjs
node art/cards/render-redo.mjs
