#!/bin/sh
# Lighthouse mobile preset, N runs, medians. Needs the lighthouse CLI (LIGHTHOUSE=path) and
# Chrome (CHROME_PATH). Serve the site first: python3 tools/gzserve.py
# Usage: tools/lighthouse.sh [url] [runs] [outdir]
URL=${1:-http://127.0.0.1:8767/}; RUNS=${2:-5}; OUT=${3:-/tmp/lh}
LH=${LIGHTHOUSE:-lighthouse}
export CHROME_PATH=${CHROME_PATH:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
mkdir -p "$OUT"
i=1; while [ $i -le "$RUNS" ]; do
  "$LH" "$URL" --quiet --chrome-flags="--headless=new" --output=json --output-path="$OUT/run-$i.json" >/dev/null 2>&1 || echo "run $i failed"
  i=$((i + 1))
done
python3 -I "$(dirname "$0")/lighthouse_summary.py" "$OUT"
