#!/usr/bin/env bash
# =============================================================================
# run_experiment.sh -- the whole measurement pipeline, in one command.
# Run INSIDE the QEMU guest.
#
#   bash scripts/run_experiment.sh [loops]
#
# For each of raytrace and pyflate it:
#   1. verifies the optimized variant is behaviour-preserving (refuses to
#      report numbers otherwise),
#   2. measures baseline and optimized with pyperf (mean +- stddev),
#   3. collects perf stat hardware counters for both,
#   4. records a sampled profile and renders a flame graph for both,
#   5. prints the pyperf compare_to verdict -- the number the 7% target is
#      judged on.
#
# Everything lands in results/.
# =============================================================================
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/results"
mkdir -p "$OUT"
LOOPS="${1:-5}"
PY=python3-dbg
FG=/opt/FlameGraph

if ! command -v $PY >/dev/null; then
    echo "python3-dbg missing -- run: bash scripts/setup_vm.sh"
    exit 1
fi
if ! $PY -c "import pyperf" 2>/dev/null; then
    echo "pyperf missing under python3-dbg -- run: $PY -m pip install pyperf pyperformance"
    exit 1
fi

EVENTS="task-clock,cycles,instructions,branches,branch-misses,cache-references,cache-misses,page-faults,context-switches"

# --- flame graph helper -----------------------------------------------------
# Ubuntu's linux-tools does not ship perf's built-in flamegraph generator, so we
# fall back to Brendan Gregg's scripts (the ones Lecture 4 credits).
make_flamegraph() {           # $1 = perf.data path   $2 = output basename
    local data="$1" out="$2"
    cd "$OUT"
    if perf script report flamegraph -i "$data" >/dev/null 2>&1 && [ -f flamegraph.html ]; then
        mv flamegraph.html "${out}.html"
        echo "   flame graph -> results/${out}.html"
    elif [ -x "$FG/flamegraph.pl" ]; then
        perf script -i "$data" 2>/dev/null \
            | "$FG/stackcollapse-perf.pl" 2>/dev/null \
            | "$FG/flamegraph.pl" --title "$out" > "${out}.svg" 2>/dev/null
        if [ -s "${out}.svg" ]; then
            echo "   flame graph -> results/${out}.svg"
        else
            echo "   (flame graph generation produced no output)"
        fi
    else
        echo "   (no flame graph tooling found; see scripts/setup_vm.sh)"
    fi
    cd "$ROOT"
}

# --- environment capture ----------------------------------------------------
{
    echo "date   : $(date)"
    echo "kernel : $(uname -r)"
    echo "python : $($PY -VV 2>&1 | head -1)"
    echo "perf   : $(perf --version 2>&1)"
    echo "cores  : $(nproc)"
    grep -m1 'model name' /proc/cpuinfo
    echo "note   : measurements taken inside QEMU/KVM guest"
} > "$OUT/environment.txt"
cat "$OUT/environment.txt"

# --- step 0: correctness ----------------------------------------------------
echo ""
echo "============================================================"
echo "  STEP 0 -- correctness: optimized must match original"
echo "============================================================"
$PY "$ROOT/scripts/verify_correctness.py" 2>&1 | tee "$OUT/correctness.txt"
if ! grep -q "raytrace   PASS" "$OUT/correctness.txt" || ! grep -q "pyflate    PASS" "$OUT/correctness.txt"; then
    echo ""
    echo "!! Correctness FAILED -- refusing to report performance numbers."
    echo "!! An optimization that changes the output is a bug, not a speedup."
    exit 1
fi

# --- per benchmark ----------------------------------------------------------
for B in raytrace pyflate; do
    for V in original optimized; do
        case $V in
            original)  TAG=base ;;
            optimized) TAG=opt  ;;
        esac
        echo ""
        echo "============================================================"
        echo "  $B / $V"
        echo "============================================================"
        SRC="$ROOT/benchmarks/$V/bm_$B"

        echo "-- pyperf statistics"
        ( cd "$SRC" && $PY run_benchmark.py -o "$OUT/${B}_${TAG}.json" ) 2>&1 | tail -4

        echo "-- perf stat"
        perf stat -e "$EVENTS" -o "$OUT/${B}_${TAG}_stat.txt" \
            $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" "$V" >/dev/null 2>&1 \
            || perf stat -o "$OUT/${B}_${TAG}_stat.txt" \
               $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" "$V" >/dev/null 2>&1
        sed -n '1,40p' "$OUT/${B}_${TAG}_stat.txt"

        echo "-- perf record (-F 999 -g) + flame graph"
        perf record -F 999 -g -q -o "$OUT/${B}_${TAG}.perf.data" \
            $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" "$V" >/dev/null 2>&1
        perf report -i "$OUT/${B}_${TAG}.perf.data" --stdio 2>/dev/null \
            | head -60 > "$OUT/${B}_${TAG}_report.txt"
        echo "   top frames:"
        grep -v '^#' "$OUT/${B}_${TAG}_report.txt" | grep -v '^$' | head -12
        make_flamegraph "${B}_${TAG}.perf.data" "${B}_${TAG}_flame"
    done

    echo ""
    echo "------------------------------------------------------------"
    echo "  $B -- BEFORE/AFTER (pyperf compare_to)"
    echo "------------------------------------------------------------"
    $PY -m pyperf compare_to "$OUT/${B}_base.json" "$OUT/${B}_opt.json" \
        --table 2>&1 | tee "$OUT/${B}_compare.txt"
done

# --- summary ----------------------------------------------------------------
echo ""
echo "============================================================"
echo "  SUMMARY -- these decide the >=7% requirement"
echo "============================================================"
for B in raytrace pyflate; do
    echo ""
    echo "### $B"
    cat "$OUT/${B}_compare.txt" 2>/dev/null
done
echo ""
echo "All artifacts in results/:"
ls -la "$OUT"
