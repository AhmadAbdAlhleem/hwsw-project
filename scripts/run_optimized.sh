#!/usr/bin/env bash
# =============================================================================
# run_optimized.sh -- measure the optimized variants and compare against the
# baseline produced by run_baseline.sh.
# Run INSIDE the QEMU guest, after scripts/setup_vm.sh and scripts/run_baseline.sh.
#
#   bash scripts/run_optimized.sh [loops]
#
# Produces, under results/:
#   <bench>_opt.json         pyperf statistics for the optimized variant
#   <bench>_opt_stat.txt     perf stat counters
#   <bench>_opt.perf.data    sampled profile
#   <bench>_opt_report.txt   perf report
#   <bench>_opt_flame.html   flame graph
#   <bench>_compare.txt      pyperf compare_to: the official before/after verdict
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

echo "============================================================"
echo "  STEP 0: correctness -- optimized must match original"
echo "============================================================"
$PY "$ROOT/scripts/verify_correctness.py" | tee "$OUT/correctness.txt"
if ! grep -q "raytrace   PASS" "$OUT/correctness.txt" || ! grep -q "pyflate    PASS" "$OUT/correctness.txt"; then
    echo ""
    echo "!! Correctness check FAILED -- refusing to report performance numbers."
    echo "!! An optimization that changes the output is a bug, not a speedup."
    exit 1
fi

for B in raytrace pyflate; do
    echo ""
    echo "============================================================"
    echo "  OPTIMIZED: $B"
    echo "============================================================"
    SRC="$ROOT/benchmarks/optimized/bm_$B"

    echo "-- pyperf statistics"
    ( cd "$SRC" && $PY run_benchmark.py -o "$OUT/${B}_opt.json" ) 2>&1 | tail -5

    echo "-- perf stat"
    perf stat -e "$EVENTS" -o "$OUT/${B}_opt_stat.txt" \
        $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" optimized >/dev/null 2>&1 \
        || perf stat -o "$OUT/${B}_opt_stat.txt" \
           $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" optimized >/dev/null 2>&1
    sed -n '1,40p' "$OUT/${B}_opt_stat.txt"

    echo "-- perf record + flame graph"
    perf record -F 999 -g -q -o "$OUT/${B}_opt.perf.data" \
        $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" optimized >/dev/null 2>&1
    perf report -i "$OUT/${B}_opt.perf.data" --stdio 2>/dev/null \
        | head -60 > "$OUT/${B}_opt_report.txt"
    cd "$OUT"
    if perf script -i "${B}_opt.perf.data" report flamegraph >/dev/null 2>&1; then
        mv flamegraph.html "${B}_opt_flame.html" 2>/dev/null
        echo "   -> results/${B}_opt_flame.html"
    fi
    cd "$ROOT"

    echo ""
    echo "-- BEFORE/AFTER (pyperf compare_to)"
    if [ -f "$OUT/${B}_base.json" ]; then
        $PY -m pyperf compare_to "$OUT/${B}_base.json" "$OUT/${B}_opt.json" \
            --table 2>&1 | tee "$OUT/${B}_compare.txt"
    else
        echo "   no baseline found ($OUT/${B}_base.json) -- run scripts/run_baseline.sh first"
    fi
done

echo ""
echo "============================================================"
echo "  SUMMARY -- the numbers that decide the 7% requirement"
echo "============================================================"
for B in raytrace pyflate; do
    if [ -f "$OUT/${B}_compare.txt" ]; then
        echo "--- $B ---"
        cat "$OUT/${B}_compare.txt"
    fi
done
echo ""
echo "All results are in results/"
ls -la "$OUT"
