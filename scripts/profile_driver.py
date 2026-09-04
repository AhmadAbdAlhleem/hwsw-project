#!/usr/bin/env python3
"""
profile_driver.py -- run one benchmark's core workload in THIS process.

pyperf normally forks worker processes, which turns a `perf record` profile into
a mess of short-lived children. This driver calls the benchmark function
directly, so the sampled profile contains exactly the workload we care about.

    python3-dbg scripts/profile_driver.py raytrace 5
    python3-dbg scripts/profile_driver.py pyflate  5 optimized
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load(bench, variant):
    path = os.path.join(ROOT, "benchmarks", variant, "bm_" + bench, "run_benchmark.py")
    if not os.path.exists(path):
        sys.exit("no such benchmark source: " + path)
    spec = importlib.util.spec_from_file_location("bm_" + bench, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod, path


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: profile_driver.py <raytrace|pyflate> [loops] [original|optimized]")
    bench = sys.argv[1]
    loops = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    variant = sys.argv[3] if len(sys.argv) > 3 else "original"

    mod, path = load(bench, variant)
    print("[driver] %s/%s loops=%d (%s)" % (variant, bench, loops, path))

    if bench == "raytrace":
        dt = mod.bench_raytrace(loops, mod.DEFAULT_WIDTH, mod.DEFAULT_HEIGHT, None)
    elif bench == "pyflate":
        data = os.path.join(ROOT, "benchmarks", variant, "bm_pyflate",
                            "data", "interpreter.tar.bz2")
        dt = mod.bench_pyflake(loops, data)
    else:
        sys.exit("unknown benchmark " + bench)

    print("[driver] %d loops in %.4f s  (%.2f ms/loop)" % (loops, dt, dt / loops * 1000))


if __name__ == "__main__":
    main()
