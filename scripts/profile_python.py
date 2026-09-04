#!/usr/bin/env python3
"""
profile_python.py -- Python-level attribution with cProfile.

perf samples the CPython interpreter, so its profiles bottom out in
_PyEval_EvalFrameDefault: they prove the workload is interpreter-bound but they
cannot say WHICH Python function is responsible. cProfile answers that, and the
two views together are the flame-graph/CPI-stack pairing Lecture 4 recommends --
one tells you where in the code, the other tells you why in the machine.

The per-function fractions reported here are what bound any accelerator's
benefit under Amdahl's law.

    python3 scripts/profile_python.py [original|optimized]
"""
import cProfile
import importlib.util
import io
import os
import pstats
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load(bench, variant):
    path = os.path.join(ROOT, "benchmarks", variant, "bm_" + bench, "run_benchmark.py")
    spec = importlib.util.spec_from_file_location("bm_%s_%s" % (bench, variant), path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def run(bench, variant, loops):
    mod = load(bench, variant)
    if bench == "raytrace":
        fn = lambda: mod.bench_raytrace(loops, mod.DEFAULT_WIDTH, mod.DEFAULT_HEIGHT, None)
    else:
        data = os.path.join(ROOT, "benchmarks", variant, "bm_pyflate",
                            "data", "interpreter.tar.bz2")
        fn = lambda: mod.bench_pyflake(loops, data)

    pr = cProfile.Profile()
    pr.enable()
    fn()
    pr.disable()

    buf = io.StringIO()
    st = pstats.Stats(pr, stream=buf)
    total = st.total_tt

    print("=" * 74)
    print("  cProfile: %s / %s   (%d loop(s), %.3f s under the profiler)"
          % (bench, variant, loops, total))
    print("=" * 74)
    print("  %-9s %-8s %-9s %s" % ("tottime", "share", "calls", "function"))
    print("  " + "-" * 70)

    rows = []
    for func, (cc, nc, tt, ct, callers) in st.stats.items():
        rows.append((tt, nc, func))
    rows.sort(reverse=True)

    shown = 0
    for tt, nc, func in rows:
        if shown >= 12:
            break
        fname, line, name = func
        base = os.path.basename(fname)
        label = "%s (%s:%s)" % (name, base, line) if base != "~" else name
        print("  %-9.3f %-8s %-9d %s"
              % (tt, "%.1f%%" % (100.0 * tt / total if total else 0), nc, label))
        shown += 1

    print()
    print("  NOTE: cProfile adds per-call overhead, so it exaggerates the cost of")
    print("  functions called very often. Use these SHARES to rank hotspots, and the")
    print("  pyperf timings for absolute performance.")
    print()


def main():
    variant = sys.argv[1] if len(sys.argv) > 1 else "original"
    run("raytrace", variant, 1)
    run("pyflate", variant, 1)


if __name__ == "__main__":
    main()
