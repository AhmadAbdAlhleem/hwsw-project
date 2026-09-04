#!/usr/bin/env bash
# =============================================================================
# measure_benchmark.sh <raytrace|pyflate> -- full measurement for ONE benchmark.
#
# Shared implementation behind script_raytrace.sh and script_pyflate.sh. Run
# INSIDE the QEMU guest. Covers everything the project specification asks a
# per-benchmark script to do:
#   1. environment setup and dependency installation
#   2. benchmark execution and performance capture (pyperf + perf stat)
#   3. flame graph and profiling data generation
#   4. post-optimization execution and before/after comparison
# =============================================================================
set -uo pipefail

B="${1:-}"
case "$B" in
    raytrace|pyflate) ;;
    *) echo "usage: $0 <raytrace|pyflate>"; exit 2 ;;
esac

LOOPS="${2:-5}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/results"
mkdir -p "$OUT"
PY=python3-dbg
FG=/opt/FlameGraph
EVENTS="task-clock,cycles,instructions,branches,branch-misses,cache-references,cache-misses,page-faults,context-switches"

banner() { echo ""; echo "============================================================"; \
           echo "  $*"; echo "============================================================"; }

# ---------------------------------------------------------------------------
banner "1/5  Environment and dependencies -- $B"
# ---------------------------------------------------------------------------
if ! command -v $PY >/dev/null 2>&1 || ! $PY -c "import pyperf" 2>/dev/null; then
    echo "setting up (python3-dbg, pyperf, perf, FlameGraph)..."
    bash "$ROOT/scripts/setup_vm.sh" || exit 1
fi
{
    echo "date   : $(date)"
    echo "kernel : $(uname -r)"
    echo "python : $($PY -VV 2>&1 | head -1)"
    echo "perf   : $(perf --version 2>&1)"
    echo "cores  : $(nproc)"
    grep -m1 'model name' /proc/cpuinfo
    echo "note   : measured inside the QEMU/KVM guest"
} | tee "$OUT/environment.txt"

# ---------------------------------------------------------------------------
banner "2/5  Correctness -- optimized must match original"
# ---------------------------------------------------------------------------
# A performance number from a variant that changes the output is meaningless,
# so this gate runs before anything is timed.
$PY "$ROOT/scripts/verify_correctness.py" 2>&1 | tee "$OUT/correctness.txt"
grep -q "$B" "$OUT/correctness.txt" || true
if ! grep -qE "^  $B +PASS" "$OUT/correctness.txt"; then
    echo "!! correctness FAILED for $B -- refusing to report performance"; exit 1
fi

# ---------------------------------------------------------------------------
banner "3/5  Measure both variants -- $B"
# ---------------------------------------------------------------------------
for V in original optimized; do
    case $V in original) T=base ;; optimized) T=opt ;; esac
    echo ""
    echo "--- $B / $V ---"
    SRC="$ROOT/benchmarks/$V/bm_$B"

    echo "[pyperf] statistics"
    rm -f "$OUT/${B}_${T}.json"          # pyperf refuses to overwrite
    ( cd "$SRC" && $PY run_benchmark.py -o "$OUT/${B}_${T}.json" ) 2>&1 | tail -3

    echo "[perf stat] counters"
    perf stat -e "$EVENTS" -o "$OUT/${B}_${T}_stat.txt" \
        $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" "$V" >/dev/null 2>&1 \
        || perf stat -o "$OUT/${B}_${T}_stat.txt" \
           $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" "$V" >/dev/null 2>&1

    # The guest vPMU has only 4 generic counters; a 9-event run multiplexes them
    # and reports cycles as 0, so IPC needs its own 2-event run.
    echo "[perf stat] cycles/instructions only (IPC)"
    perf stat -e cycles,instructions -o "$OUT/${B}_${T}_ipc.txt" \
        $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" "$V" >/dev/null 2>&1
    grep -E "cycles|instructions|insn per cycle" "$OUT/${B}_${T}_ipc.txt" || true

    # perf's default cycles:ppp is a PEBS event and PEBS is not virtualised in
    # this guest, so sample on cpu-clock instead.
    echo "[perf record] sampling + flame graph"
    perf record -e cpu-clock -F 999 -g -q -o "$OUT/${B}_${T}.perf.data" \
        $PY "$ROOT/scripts/profile_driver.py" "$B" "$LOOPS" "$V" >/dev/null 2>&1
    perf report -i "$OUT/${B}_${T}.perf.data" --stdio 2>/dev/null \
        | head -60 > "$OUT/${B}_${T}_report.txt"
    ( cd "$OUT" && perf script -i "${B}_${T}.perf.data" 2>/dev/null \
        | "$FG/stackcollapse-perf.pl" 2>/dev/null \
        | "$FG/flamegraph.pl" --title "$B $V" > "${B}_${T}_flame.svg" 2>/dev/null )
    echo "   flame graph: results/${B}_${T}_flame.svg ($(stat -c%s "$OUT/${B}_${T}_flame.svg" 2>/dev/null || echo 0) bytes)"
done

# ---------------------------------------------------------------------------
banner "4/5  Python-level attribution (cProfile)"
# ---------------------------------------------------------------------------
# perf bottoms out in _PyEval_EvalFrameDefault and cannot attribute time to
# individual Python functions; cProfile supplies that half of the picture.
python3 "$ROOT/scripts/profile_python.py" original  2>&1 | sed -n "/$B/,/^$/p" | head -25
python3 "$ROOT/scripts/profile_python.py" optimized 2>&1 | sed -n "/$B/,/^$/p" | head -25

# ---------------------------------------------------------------------------
banner "5/5  BEFORE / AFTER -- $B"
# ---------------------------------------------------------------------------
$PY -m pyperf compare_to "$OUT/${B}_base.json" "$OUT/${B}_opt.json" --table \
    2>&1 | tee "$OUT/${B}_compare.txt"

echo ""
echo "All artifacts for $B are in results/"
