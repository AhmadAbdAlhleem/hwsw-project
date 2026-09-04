# Measured results

All numbers measured **inside the course QEMU/KVM guest**, never on the host.

**Environment**
```
kernel : 5.15.0-1080-kvm  (Ubuntu 22.04.5 LTS guest)
python : Python 3.10.12 debug build (python3-dbg), GCC 11.4.0
perf   : 5.15.179
cpu    : Intel Xeon E5-2630 v3 @ 2.40GHz (Haswell), 8 vCPU under QEMU/KVM
pyperf : 2.10.0
```

## Headline result — `pyperf compare_to`

| Benchmark | Original | Optimized | Speedup | Improvement |
|---|---|---|---|---|
| raytrace | 2.15 s ± 0.02 s | 718 ms ± 4 ms | **2.99x faster** | **66.6 %** |
| pyflate  | 3.14 s ± 0.02 s | 2.59 s ± 0.02 s | **1.21x faster** | **17.5 %** |

Both clear the project's >= 7 % bar. Standard deviations are ~1 % of the mean, so
both differences are far outside measurement noise.

## Correctness (checked before any performance number was recorded)

| Benchmark | Check | Result |
|---|---|---|
| raytrace | sha256 of rendered PPM, original vs optimized | identical (`520b45b95e22ba0c...`) |
| pyflate  | benchmark's built-in md5 of decompressed output | matches reference digest |

## Hardware counters

Measured with `perf stat -e cycles,instructions` **alone**. The guest vPMU
exposes only 4 generic counters, so requesting six hardware events at once
multiplexed them and reported `cycles` as 0; restricting the run to two events
removes the multiplexing.

| Metric | raytrace orig | raytrace opt | ratio | pyflate orig | pyflate opt | ratio |
|---|---|---|---|---|---|---|
| Cycles | 26.67 B | 9.07 B | **2.94x fewer** | 37.94 B | 31.35 B | **1.21x fewer** |
| Instructions | 55.18 B | 19.88 B | **2.78x fewer** | 83.41 B | 68.76 B | **1.21x fewer** |
| IPC | 2.07 | 2.19 | +5.8 % | 2.20 | 2.19 | flat |
| Elapsed (5 loops) | 11.22 s | 3.82 s | 2.94x | 15.95 s | 13.17 s | 1.21x |

Secondary counters (from the nine-event run; hardware events there are
multiplexed and therefore approximate, software events are exact):

| Metric | raytrace orig | raytrace opt | pyflate orig | pyflate opt |
|---|---|---|---|---|
| Task-clock | 10 856 ms | 3 793 ms | 16 143 ms | 13 262 ms |
| Branches | 12.92 B | 4.71 B | 20.74 B | 16.81 B |
| Branch-miss rate | 0.89 % | 0.73 % | 0.48 % | 0.45 % |
| Cache references | 35.9 M | 14.2 M | 47.5 M | 41.3 M |
| Cache-miss rate | 0.55 % | 1.16 % | 6.78 % | 7.89 % |
| Page faults | 3 391 | 3 389 | 46 034 | 46 038 |
| Context switches | 8 | 8 | 33 | 20 |

## Reading the counters

**The speedup is removed work, not better execution efficiency.** For pyflate,
cycles and instructions both fall by exactly the same 1.21x and **IPC is flat
(2.20 -> 2.19)**: the CPU is executing just as efficiently per cycle, it simply
has far less to execute. For raytrace the same holds with a small bonus — IPC
rises 2.07 -> 2.19 (+5.8 %) because `__slots__` and the removed temporaries
shrink the object graph, so the 2.94x cycle reduction slightly outpaces the
2.78x instruction reduction.

**Page faults and context switches are unchanged** (3 391 vs 3 389; 46 034 vs
46 038). Neither benchmark's memory footprint or scheduling behaviour moved, so
the measurement is not contaminated by I/O or scheduler effects — the difference
is pure user-space compute. This is the same invariant argument used in HW1,
where identical instruction counts proved only the data layout had changed.

**The cache-miss *rate* rises while performance improves** (raytrace 0.55 % ->
1.16 %). This is the trap Tutorial 2 sets deliberately with its 2D-array demo: a
ratio whose denominator collapses can move the wrong way. Absolute cache
references fell 2.52x (35.9 M -> 14.2 M) and absolute misses also fell
(197 020 -> 165 126); only the quotient rose. Always report absolute counts.

## Profiling notes / threats to validity

- **PEBS is not virtualized in this guest.** `perf record`'s default event is
  `cycles:ppp`, a precise event; with no PEBS it collected almost no samples
  (14 KB `perf.data`, empty reports, 579-byte flame graphs). Re-running with
  `-e cpu-clock` — a software, time-based event, which is exactly what a flame
  graph wants — produced real profiles (108-136 KB flame graphs).
- **Counter multiplexing.** The vPMU has 4 generic counters. Any `perf stat`
  requesting more than that time-shares them and extrapolates; that is why the
  nine-event runs reported `cycles = 0`. Hardware-event values from those runs
  are approximate.
- **Virtualization overhead.** Everything runs in a KVM guest, where a vmexit
  costs roughly 1000-4000 cycles and a TLB miss requires a two-dimensional page
  walk. Both variants of each benchmark pay this equally, so the *comparison* is
  sound, but the absolute times are not bare-metal numbers.

## Where the time goes

`perf report` self time, top frame in all four profiles:

| Profile | Top symbol | Self |
|---|---|---|
| raytrace original | `_PyEval_EvalFrameDefault` | 28.77 % |
| raytrace optimized | `_PyEval_EvalFrameDefault` | 33.77 % |
| pyflate original | `_PyEval_EvalFrameDefault` | 24.28 % |
| pyflate optimized | `_PyEval_EvalFrameDefault` | 20.39 % |

`_PyEval_EvalFrameDefault` is CPython's bytecode dispatch loop. That it
dominates every profile is the central fact for the hardware-acceleration
argument: for these workloads the machine spends most of its time *interpreting*
rather than computing. Note it rises to 33.77 % of raytrace after optimization —
we removed the surrounding call and allocation overhead, so what remains is a
larger *fraction* of interpreter dispatch, even though its absolute cost fell.

Artifacts: `*_flame.svg` (flame graphs), `*_report.txt` (perf report),
`*_stat.txt` (nine-event perf stat), `*_ipc.txt` (cycles/instructions),
`*_base.json` / `*_opt.json` (raw pyperf samples), `*_compare.txt`.
