#!/usr/bin/env bash
# =============================================================================
# run_baseline.sh -- baseline measurement + flame graphs for both benchmarks.
# Run INSIDE the guest, after scripts/setup_vm.sh.
#
#   bash scripts/run_baseline.sh [loops]
#
# Produces, under results/:
#   <bench>_base.json        pyperf statistics (mean +- stddev, all samples)
#   <bench>_base_stat.txt    perf stat counters
#   <bench>_base.perf.data   sampled profile
#   <bench>_base_report.txt  perf report (Children/Self)
#   <bench>_base_flame.html  flame graph
# =============================================================================
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/results"
mkdir -p "$OUT"
LOOPS="${1:-5}"
PY=python3-dbg

if ! command -v $PY >/dev/null; then
    echo "python3-dbg missing -- run: bash scripts/setup_vm.sh"
    exit 1
fi

EVENTS="task-clock,cycles,instructions,branches,branch-misses,cache-references,cache-misses,page-faults,context-switches"

{
    echo "date   : $(date)"
    echo "kernel : $(uname -r)"
    echo "python : $($PY -VV 2>&1 | head -1)"
    echo "perf   : $(perf --version 2>&1)"
    echo "cores  : $(nproc)"
    grep -m1 'model name' /proc/cpuinfo
} > "$OUT/environment.txt"
cat "$OUT/environment.txt"

for B in raytrace pyflate; do
    echo ""
    echo "============================================================"
    echo "  BASELINE: $B"
    echo "============================================================"
    SRC="$ROOT/benchmarks/original/bm_$B"

    echo "-- pyperf statistics (this is the number the 7% target is judged on)"
    ( cd "$SRC" && $PY run_benchmark.py -o "$OUT/${B}_base.json" ) 2>&1 | tail -5

    echo "-- perf stat"
    perf stat -e "$EVENTS" -o "$OUT/${B}_base_stat.txt" \
        $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" original >/dev/null 2>&1 \
        || perf stat -o "$OUT/${B}_base_stat.txt" \
           $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" original >/dev/null 2>&1
    sed -n '1,40p' "$OUT/${B}_base_stat.txt"

    echo "-- perf record (-F 999 -g, as the project guide specifies)"
    perf record -F 999 -g -q -o "$OUT/${B}_base.perf.data" \
        $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" original >/dev/null 2>&1
    perf report -i "$OUT/${B}_base.perf.data" --stdio 2>/dev/null \
        | head -60 > "$OUT/${B}_base_report.txt"
    echo "   top frames:"
    sed -n '1,25p' "$OUT/${B}_base_report.txt"

    echo "-- flame graph"
    cd "$OUT"
    if perf script -i "${B}_base.perf.data" report flamegraph >/dev/null 2>&1; then
        mv flamegraph.html "${B}_base_flame.html" 2>/dev/null
        echo "   -> results/${B}_base_flame.html"
    else
        echo "   (built-in flamegraph unavailable; perf report text saved instead)"
    fi
    cd "$ROOT"
done

echo ""
echo "============================================================"
echo "  Baseline done. Everything is in results/"
echo "============================================================"
ls -la "$OUT"
