#!/usr/bin/env bash
# =============================================================================
# script_raytrace.sh -- run, profile and compare the raytrace benchmark.
# Run INSIDE the course QEMU guest:   bash script_raytrace.sh
#
# Performs the four steps the project specification requires:
#   1. environment setup and dependency installation (python3-dbg, pyperf,
#      perf, FlameGraph) -- skipped automatically if already present
#   2. benchmark execution and performance capture
#   3. flame graph and profiling data generation
#   4. post-optimization execution with a before/after comparison
#
# Results are written to results/. See report_raytrace.txt for the analysis.
# =============================================================================
exec bash "$(dirname "$0")/scripts/measure_benchmark.sh" raytrace "${1:-5}"
