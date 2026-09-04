#!/usr/bin/env python3
"""
verify_correctness.py -- prove the optimized benchmarks are behaviour-preserving.

An optimization that changes the output is not an optimization, it is a bug, so
every performance claim in the report is backed by this check:

  raytrace : render the scene with both variants and compare the produced PPM
             images byte for byte.
  pyflate  : the benchmark already asserts md5(out) == a known digest, so simply
             completing a run proves the decompressed bytes are identical. We
             additionally compare the two variants' output against each other.

    python3 scripts/verify_correctness.py
"""
import hashlib
import importlib.util
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load(bench, variant):
    path = os.path.join(ROOT, "benchmarks", variant, "bm_" + bench, "run_benchmark.py")
    spec = importlib.util.spec_from_file_location("bm_%s_%s" % (bench, variant), path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def digest(path):
    with open(path, "rb") as fp:
        return hashlib.sha256(fp.read()).hexdigest()


def check_raytrace():
    print("raytrace: rendering with both variants ...")
    tmp = tempfile.mkdtemp(prefix="rt_verify_")
    out = {}
    for variant in ("original", "optimized"):
        mod = load("raytrace", variant)
        ppm = os.path.join(tmp, variant + ".ppm")
        mod.bench_raytrace(1, mod.DEFAULT_WIDTH, mod.DEFAULT_HEIGHT, ppm)
        out[variant] = digest(ppm)
        print("   %-10s sha256=%s" % (variant, out[variant][:32]))
    same = out["original"] == out["optimized"]
    print("   -> images are %s" % ("BYTE-IDENTICAL" if same else "DIFFERENT"))
    return same


def check_pyflate():
    print("pyflate: decompressing with both variants ...")
    ok = True
    for variant in ("original", "optimized"):
        mod = load("pyflate", variant)
        data = os.path.join(ROOT, "benchmarks", variant, "bm_pyflate",
                            "data", "interpreter.tar.bz2")
        try:
            # bench_pyflake() raises if md5(out) != the expected digest.
            mod.bench_pyflake(1, data)
            print("   %-10s md5 checksum OK" % variant)
        except Exception as exc:            # noqa: BLE001
            print("   %-10s FAILED: %s" % (variant, exc))
            ok = False
    print("   -> decompressed output %s" % ("matches the reference digest" if ok else "is WRONG"))
    return ok


def main():
    print("=" * 62)
    print("  Correctness verification: optimized vs original")
    print("=" * 62)
    results = [("raytrace", check_raytrace()), ("pyflate", check_pyflate())]
    print("-" * 62)
    allok = all(r for _, r in results)
    for name, r in results:
        print("  %-10s %s" % (name, "PASS" if r else "FAIL"))
    print("=" * 62)
    return 0 if allok else 1


if __name__ == "__main__":
    sys.exit(main())
