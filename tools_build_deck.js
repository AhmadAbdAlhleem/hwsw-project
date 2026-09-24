const pptxgen = require("pptxgenjs");
const path = require("path");

const OUT = process.argv[2] || "presentation.pptx";

// ---- palette: taken from the subject matter (flame graphs are orange) ------
const DARK = "1A1D23";
const LIGHT = "F7F7F5";
const FLAME = "E8552D";   // accent - software / profiling
const TEAL = "2D9596";    // accent - hardware
const MUTED = "6B7280";
const WHITE = "FFFFFF";
const INK = "23272E";
const CARD = "FFFFFF";

const HFONT = "Cambria";
const BFONT = "Calibri";
const MONO = "Courier New";

const W = 13.3, H = 7.5, M = 0.65;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Ahmad Abd Alhaleem, Osama Abd Alhaleem";
pres.title = "Benchmark Optimization and Hardware Acceleration";

// ---------------------------------------------------------------- helpers --
function darkSlide() {
  const s = pres.addSlide();
  s.background = { color: DARK };
  return s;
}

function lightSlide(title, kicker) {
  const s = pres.addSlide();
  s.background = { color: LIGHT };
  if (kicker) {
    s.addText(kicker.toUpperCase(), {
      x: M, y: 0.34, w: 9, h: 0.26, isTextBox: true, margin: 0,
      fontFace: BFONT, fontSize: 11, bold: true, color: FLAME, charSpacing: 2,
    });
  }
  s.addText(title, {
    x: M, y: kicker ? 0.62 : 0.5, w: W - 2 * M, h: 0.7, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 32, bold: true, color: INK,
  });
  return s;
}

function card(s, x, y, w, h, fill) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06,
    fill: { color: fill || CARD },
    line: { color: "E3E3DF", width: 1 },
    shadow: { type: "outer", color: "9A9A95", blur: 6, offset: 1, angle: 90, opacity: 0.18 },
  });
}

function stat(s, x, y, w, value, label, color) {
  s.addText(value, {
    x, y, w, h: 0.72, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 40, bold: true, color: color || FLAME,
  });
  s.addText(label, {
    x, y: y + 0.7, w, h: 0.5, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, color: MUTED,
  });
}

function numDot(s, x, y, n, color) {
  s.addShape(pres.ShapeType.ellipse, {
    x, y, w: 0.34, h: 0.34, fill: { color: color || FLAME },
  });
  s.addText(String(n), {
    x, y, w: 0.34, h: 0.34, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle",
  });
}

function body(s, text, x, y, w, h, size) {
  s.addText(text, {
    x, y, w, h, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: size || 14, color: INK, lineSpacingMultiple: 1.15,
  });
}

function bullets(s, items, x, y, w, h, size) {
  s.addText(items.map((t, i) => ({
    text: t, options: { bullet: true, breakLine: i !== items.length - 1 },
  })), {
    x, y, w, h, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: size || 14, color: INK, paraSpaceAfter: 8,
  });
}

function tbl(s, rows, x, y, w, colW, fontSize) {
  s.addTable(rows, {
    x, y, w, colW,
    fontFace: BFONT, fontSize: fontSize || 12, color: INK,
    border: { type: "solid", color: "E3E3DF", pt: 1 },
    fill: { color: CARD },
    rowH: 0.3, valign: "middle",
  });
}

// =================================================================== 1 title
{
  const s = darkSlide();
  s.addText("Benchmark Optimization,\nAnalysis and Hardware Acceleration", {
    x: M, y: 1.9, w: 9.6, h: 1.9, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 40, bold: true, color: WHITE, lineSpacingMultiple: 1.05,
  });
  s.addText("raytrace  ·  pyflate  ·  a ray–sphere intersection unit in Verilog", {
    x: M, y: 3.95, w: 10, h: 0.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 16, color: FLAME,
  });
  s.addText("Hardware/Software Co-Design (00460882) — Technion", {
    x: M, y: 5.5, w: 8, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13, color: "9AA0A6",
  });
  s.addText("Ahmad Abd Alhaleem (322457763)   ·   Osama Abd Alhaleem (212604102)", {
    x: M, y: 5.85, w: 9, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13, color: "9AA0A6",
  });
  // headline results, right side
  s.addShape(pres.ShapeType.roundRect, {
    x: 10.5, y: 1.9, w: 2.15, h: 2.3, rectRadius: 0.08,
    fill: { color: "24282F" }, line: { color: "343A43", width: 1 },
  });
  s.addText("2.56×", { x: 10.5, y: 2.1, w: 2.15, h: 0.7, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 34, bold: true, color: FLAME, align: "center" });
  s.addText("raytrace", { x: 10.5, y: 2.75, w: 2.15, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, color: "9AA0A6", align: "center" });
  s.addText("1.48×", { x: 10.5, y: 3.15, w: 2.15, h: 0.6, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 28, bold: true, color: TEAL, align: "center" });
  s.addText("pyflate", { x: 10.5, y: 3.72, w: 2.15, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, color: "9AA0A6", align: "center" });
  s.addNotes("Opening. We optimized two pyperformance benchmarks and designed a hardware accelerator for the hotspot that survived optimization. Both benchmarks beat the 7% requirement by a wide margin: raytrace 2.56x, pyflate 1.48x, measured on the release interpreter. The talk follows the order we actually worked in.");
}

// ============================================================ 2 the two picks
{
  const s = lightSlide("Two benchmarks, deliberately unalike", "What we chose and why");
  body(s, "The project asks for two benchmarks from an approved list. We picked a pair that stress the machine in opposite ways, so that the hardware conclusions would differ rather than repeat.", M, 1.55, 11.9, 0.6, 14);

  card(s, M, 2.35, 5.75, 3.5);
  s.addText("raytrace", { x: M + 0.3, y: 2.55, w: 4, h: 0.4, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 22, bold: true, color: FLAME });
  bullets(s, [
    "Renders a 100×100 image of 7 spheres + a ground plane",
    "Pure-Python float vector maths — no numpy, no C",
    "Regular, fixed-shape arithmetic",
    "204,958 ray–object intersection tests per frame",
  ], M + 0.3, 3.1, 5.15, 2.4, 13);

  card(s, 6.9, 2.35, 5.75, 3.5);
  s.addText("pyflate", { x: 7.2, y: 2.55, w: 4, h: 0.4, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 22, bold: true, color: TEAL });
  bullets(s, [
    "Pure-Python bzip2 / DEFLATE decompressor",
    "Bit-level integer work, Huffman + BWT",
    "Irregular, data-dependent control flow",
    "Self-verifying: asserts an md5 of its output",
  ], 7.2, 3.1, 5.15, 2.4, 13);

  s.addText("Same profiling method, two very different hardware answers — that contrast is the point.", {
    x: M, y: 6.1, w: 11.9, h: 0.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 14, italic: true, color: MUTED,
  });
  s.addNotes("Most groups pick nbody + raytrace, which are both float-vector workloads and lead to the same accelerator. We deliberately paired a regular float workload with an irregular bit-serial one so the comparison would teach us something. That pays off at the end of the talk.");
}

// ================================================================= 3 method
{
  const s = lightSlide("The loop we actually ran", "Method");
  const steps = [
    ["Measure", "pyperf for time,\nperf for counters"],
    ["Find the\nbottleneck", "flame graph = where\ncProfile = which function"],
    ["Optimize", "behaviour-preserving\nrefactors only"],
    ["Re-measure", "prove it, and check\nwhat moved to the top"],
    ["Then hardware", "for the residue software\ncannot remove"],
  ];
  let x = M;
  const cw = 2.24, gap = 0.19;
  steps.forEach((st, i) => {
    card(s, x, 2.3, cw, 2.5, i === 4 ? "EAF5F5" : CARD);
    numDot(s, x + 0.25, 2.55, i + 1, i === 4 ? TEAL : FLAME);
    s.addText(st[0], { x: x + 0.25, y: 3.05, w: cw - 0.5, h: 0.75, isTextBox: true, margin: 0,
      fontFace: HFONT, fontSize: 16, bold: true, color: INK });
    s.addText(st[1], { x: x + 0.25, y: 3.8, w: cw - 0.5, h: 0.9, isTextBox: true, margin: 0,
      fontFace: BFONT, fontSize: 11.5, color: MUTED });
    x += cw + gap;
  });
  s.addText("The order matters. We only argue for silicon after software has taken everything it can — Lecture 1 is explicit that accelerators are not always the answer.", {
    x: M, y: 5.35, w: 11.9, h: 0.6, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 14, color: INK,
  });
  s.addNotes("This is the course's own method: flame graph tells you where, counters tell you why, and you use them together. Step 4 matters more than it looks - re-measuring is what caught our biggest mistake, which I'll come to.");
}

// ============================================== 4 environment + credibility
{
  const s = lightSlide("Everything measured inside the course VM", "Measurement setup");
  card(s, M, 1.65, 5.75, 2.15);
  body(s, "Ubuntu 22.04.5 guest, kernel 5.15.0-1080-kvm\nPython 3.10.12 — timing: release · profiling: dbg\nperf 5.15.179 · pyperf 2.10.0 · iverilog 11.0\nXeon E5-2630 v3 @ 2.40 GHz, 8 vCPU, QEMU/KVM",
    M + 0.3, 1.9, 5.15, 1.7, 12.5);

  card(s, 6.9, 1.65, 5.75, 2.15);
  s.addText("Correctness gates every number", { x: 7.2, y: 1.88, w: 5.15, h: 0.35, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 15, bold: true, color: INK });
  body(s, "raytrace — rendered image must be byte-identical (sha256)\npyflate — the benchmark's own md5 assertion must pass\n\nEvery script refuses to print a speedup if this fails.",
    7.2, 2.3, 5.15, 1.4, 12.5);

  s.addText("Three ways the tools quietly lied to us", {
    x: M, y: 4.1, w: 11.9, h: 0.4, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 19, bold: true, color: INK });

  const pit = [
    ["PEBS isn't virtualized", "perf record defaults to cycles:ppp, a precise event. In a KVM guest it captured almost nothing — 579-byte flame graphs. Fixed by sampling cpu-clock."],
    ["Counter multiplexing", "The guest vPMU has only 4 generic counters. Asking for 6 hardware events reported cycles = 0. IPC needs its own 2-event run."],
    ["pyperf won't overwrite", "On a re-run it skipped the measurement and compare_to reported the PREVIOUS run's numbers."],
  ];
  let px = M;
  pit.forEach((p) => {
    card(s, px, 4.6, 3.9, 1.95);
    s.addText(p[0], { x: px + 0.25, y: 4.8, w: 3.4, h: 0.32, isTextBox: true, margin: 0,
      fontFace: HFONT, fontSize: 14, bold: true, color: FLAME });
    s.addText(p[1], { x: px + 0.25, y: 5.15, w: 3.4, h: 1.3, isTextBox: true, margin: 0,
      fontFace: BFONT, fontSize: 10.5, color: MUTED });
    px += 4.0;
  });
  s.addNotes("Worth a minute. Each of these produces wrong or empty data rather than an error message. We only caught them because we read the output instead of assuming the script worked. If you take one practical thing from this talk, it's that profiling tools fail silently in a VM.");
}

// ========================================================= 5 raytrace intro
{
  const s = lightSlide("raytrace: what the machine is actually doing", "Benchmark 1 — analysis");
  stat(s, M, 1.7, 2.6, "15,333", "rays cast per frame");
  stat(s, M + 2.9, 1.7, 2.9, "204,958", "intersection tests / frame");
  stat(s, M + 6.0, 1.7, 2.6, "11.7", "sphere tests per ray");
  stat(s, M + 9.0, 1.7, 2.6, "2.07", "instructions per cycle", TEAL);

  card(s, M, 3.35, 11.95, 1.5, "FDF1EC");
  s.addText("The counters say the CPU is not stalling.", {
    x: M + 0.35, y: 3.55, w: 11.2, h: 0.35, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 17, bold: true, color: INK });
  body(s, "IPC 2.07, branch-miss rate 0.89 %, cache-miss rate 0.45 %. Not memory-bound, not branch-bound, not I/O-bound. The machine is simply being asked to retire 53.3 billion instructions. So the target is instruction VOLUME, not locality.",
    M + 0.35, 3.95, 11.2, 0.8, 13.5);

  s.addText("perf's answer: 28.1 % of samples in _PyEval_EvalFrameDefault — CPython's bytecode dispatch loop.", {
    x: M, y: 5.15, w: 11.9, h: 0.35, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 14, bold: true, color: INK });
  s.addText("True, and useless on its own: every Python function executes inside that one C function, so perf can never name the Python function responsible. That is why we also ran cProfile — the flame-graph-plus-second-view pairing Lecture 4 recommends.", {
    x: M, y: 5.5, w: 11.9, h: 0.8, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13, color: MUTED });
  s.addNotes("Key teaching point: a flame graph of a Python program bottoms out in the interpreter. It proves you're interpreter-bound but can't tell you which function to fix. You need a Python-level profiler as the second view.");
}

// ======================================================= 6 the smoking gun
{
  const s = darkSlide();
  s.addText("The smoking gun", { x: M, y: 0.75, w: 8, h: 0.5, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, bold: true, color: FLAME, charSpacing: 2 });
  s.addText("3.7 % of the entire runtime\nwas spent in this function", {
    x: M, y: 1.35, w: 7.4, h: 1.5, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 32, bold: true, color: WHITE, lineSpacingMultiple: 1.05 });

  s.addShape(pres.ShapeType.roundRect, { x: M, y: 3.15, w: 7.4, h: 1.25, rectRadius: 0.06,
    fill: { color: "24282F" }, line: { color: "343A43", width: 1 } });
  s.addText("def mustBeVector(self):\n    return self", {
    x: M + 0.35, y: 3.4, w: 6.7, h: 0.8, isTextBox: true, margin: 0,
    fontFace: MONO, fontSize: 16, color: "8FD9C0" });

  s.addText("Called 520,539 times per frame — a real Python method call, frame push and pop, purely to assert an operand's type that Python already knew. It computes nothing.", {
    x: M, y: 4.65, w: 7.4, h: 1.0, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 14, color: "C8CCD2" });

  // right column - profile table
  s.addText("cProfile, baseline", { x: 8.5, y: 1.35, w: 4.2, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 11, bold: true, color: FLAME, charSpacing: 1.5 });
  const rows = [
    [{ text: "share", options: { bold: true, color: WHITE } }, { text: "function", options: { bold: true, color: WHITE } }],
    ["16.8 %", "Vector.dot"],
    ["14.5 %", "Point.__sub__"],
    ["11.8 %", "Sphere.intersectionTime"],
    ["8.7 %", "Vector.__init__"],
    ["5.1 %", "Vector.scale"],
    ["4.2 %", "Vector.normalized"],
    ["3.7 %", "Vector.mustBeVector"],
  ];
  s.addTable(rows, {
    x: 8.5, y: 1.72, w: 4.15, colW: [1.05, 3.1],
    fontFace: BFONT, fontSize: 11.5, color: "C8CCD2",
    fill: { color: "24282F" }, border: { type: "solid", color: "343A43", pt: 1 },
    rowH: 0.29, valign: "middle",
  });
  s.addText("Vector arithmetic = 56.8 % of runtime.\nThe actual geometry = 11.8 %.", {
    x: 8.5, y: 4.55, w: 4.2, h: 0.8, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13, bold: true, color: FLAME });
  s.addText("The program spent five times more effort manipulating vector objects than doing the geometry those objects exist to express.", {
    x: 8.5, y: 5.35, w: 4.2, h: 1.0, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, color: "9AA0A6" });
  s.addNotes("This is the slide to slow down on. Half a million calls a frame to a function whose body is 'return self'. It's a runtime type assertion in a dynamically typed language - the check is pure overhead. Once you see it in the profile it's obvious; nothing in the source reads as slow.");
}

// ==================================================== 7 raytrace what we did
{
  const s = lightSlide("What we changed — and what we did not", "Benchmark 1 — optimization");
  const fixes = [
    ["__slots__ everywhere", "Vector, Point, Sphere, Ray… every instance carried a full __dict__"],
    ["Killed the type assertions", "isPoint()/mustBeVector() method calls became a class-level flag"],
    ["Inlined normalized()", "was a 5-deep call chain: normalized→scale→magnitude→dot→mustBeVector"],
    ["Rewrote intersectionTime", "works on scalars — removes an allocation + 3 calls per object per ray"],
    ["Hoisted a loop invariant", "_lightIsVisible rebuilt an identical shadow ray once per scene object"],
    ["Fused list + scan", "built a tuple list per ray just to find the nearest hit"],
  ];
  let y = 1.6;
  fixes.forEach((f, i) => {
    numDot(s, M, y + 0.02, i + 1);
    s.addText(f[0], { x: M + 0.5, y, w: 3.5, h: 0.32, isTextBox: true, margin: 0,
      fontFace: BFONT, fontSize: 13.5, bold: true, color: INK });
    s.addText(f[1], { x: M + 4.05, y, w: 5.1, h: 0.4, isTextBox: true, margin: 0,
      fontFace: BFONT, fontSize: 12, color: MUTED });
    y += 0.62;
  });

  card(s, 9.55, 1.5, 3.1, 3.9, "FDF1EC");
  s.addText("Rejected", { x: 9.8, y: 1.7, w: 2.6, h: 0.3, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 15, bold: true, color: FLAME });
  s.addText("numpy — vectors are only 3 elements, so per-call ndarray overhead exceeds the arithmetic it replaces. numpy wins on large arrays; this workload has none.\n\nTuples instead of classes — that rewrites every call site: a different program, not an optimization of this one.",
    { x: 9.8, y: 2.1, w: 2.6, h: 3.1, isTextBox: true, margin: 0,
      fontFace: BFONT, fontSize: 11, color: INK });

  s.addText("No algorithm was replaced. The optimized renderer performs exactly the same 204,958 intersection tests — and produces a byte-identical image.", {
    x: M, y: 5.6, w: 11.9, h: 0.6, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 14, bold: true, color: INK });
  s.addNotes("Emphasize the last line. We didn't get the speedup by doing less geometry - the test count is identical. We made the same geometry cost less. The rejected column matters too: numpy is the obvious suggestion and it is wrong here, for a reason we can state.");
}

// ======================================================= 8 raytrace results
{
  const s = lightSlide("raytrace: 2.56× faster, identical output", "Benchmark 1 — results");
  stat(s, M, 1.55, 3.0, "804 ms → 314 ms", "release python3 · pyperf ±1 %");
  s.addText("2.56×", { x: M + 3.4, y: 1.5, w: 2.2, h: 0.9, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 52, bold: true, color: FLAME });
  s.addText("60.9 % less time\ndebug build said 2.98×\nrequirement was 7 %", { x: M + 3.4, y: 2.4, w: 2.6, h: 0.9, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, color: MUTED });

  const rows = [
    [{ text: "perf counter · dbg", options: { bold: true } }, { text: "before", options: { bold: true } },
     { text: "after", options: { bold: true } }, { text: "change", options: { bold: true } }],
    ["Cycles", "25.98 B", "9.02 B", "2.88× fewer"],
    ["Instructions", "53.33 B", "19.71 B", "2.71× fewer"],
    ["IPC", "2.07", "2.18", "≈ flat"],
    ["Cache references", "38.0 M", "15.3 M", "2.49× fewer"],
    ["Page faults", "3,391", "3,391", "identical"],
  ];
  tbl(s, rows, 6.6, 1.5, 6.05, [2.0, 1.4, 1.4, 1.25], 11.5);

  card(s, M, 3.5, 5.6, 2.6, "FDF1EC");
  s.addText("Why this is removed work, not luck", { x: M + 0.3, y: 3.7, w: 5.0, h: 0.3, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 15, bold: true, color: INK });
  s.addText("Cycles fell 2.88× and instructions 2.71× while IPC barely moved. The CPU is executing just as efficiently — it simply has 2.7 billion fewer instructions to run.\n\nPage faults are identical to the fault, so nothing here is an allocation or I/O artefact.",
    { x: M + 0.3, y: 4.05, w: 5.0, h: 1.9, isTextBox: true, margin: 0,
      fontFace: BFONT, fontSize: 12, color: INK });

  s.addText("Call counts per frame", { x: 6.6, y: 3.55, w: 6, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 11, bold: true, color: FLAME, charSpacing: 1.5 });
  const rows2 = [
    [{ text: "function", options: { bold: true } }, { text: "before", options: { bold: true } },
     { text: "after", options: { bold: true } }],
    ["Vector.dot", "509,871", "41,070"],
    ["Point.__sub__", "277,865", "26,236"],
    ["Vector.__init__", "452,943", "125,285"],
    ["mustBeVector", "520,539", "0"],
    ["intersectionTime", "179,457", "179,457"],
  ];
  tbl(s, rows2, 6.6, 3.9, 6.05, [2.55, 1.75, 1.75], 11.5);
  s.addText("last row unchanged on purpose — same work, less cost", {
    x: 6.6, y: 5.95, w: 6.05, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 11, italic: true, color: MUTED });
  s.addNotes("The two tables together are the whole argument. Left: the machine did less. Right: which Python-level work disappeared. And the last row - intersectionTime is called exactly as often - proves we didn't cheat by skipping work.");
}

// ========================================================== 9 the ratio trap
{
  const s = lightSlide("A number that got worse while the program got faster", "A trap worth knowing");
  card(s, M, 1.7, 5.75, 2.3, "FDF1EC");
  s.addText("cache-miss RATE", { x: M + 0.3, y: 1.95, w: 5.1, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, bold: true, color: MUTED, charSpacing: 1.5 });
  s.addText("0.45 %  →  1.04 %", { x: M + 0.3, y: 2.3, w: 5.1, h: 0.6, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 30, bold: true, color: FLAME });
  s.addText("more than doubled  (pyflate: 6.5 % → 12.3 %)", { x: M + 0.3, y: 2.95, w: 5.1, h: 0.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12.5, color: INK });

  card(s, 6.9, 1.7, 5.75, 2.3, "EAF5F5");
  s.addText("absolute counts", { x: 7.2, y: 1.95, w: 5.1, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, bold: true, color: MUTED, charSpacing: 1.5 });
  s.addText("references  38.0 M → 15.3 M\nmisses      171,475 → 158,894", { x: 7.2, y: 2.3, w: 5.1, h: 0.9, isTextBox: true, margin: 0,
    fontFace: MONO, fontSize: 13, color: TEAL });
  s.addText("both went DOWN", { x: 7.2, y: 3.2, w: 5.1, h: 0.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12.5, bold: true, color: INK });

  s.addText("A rate is a quotient, and we collapsed its denominator.", {
    x: M, y: 4.35, w: 11.9, h: 0.45, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 21, bold: true, color: INK });
  body(s, "Deleting hundreds of thousands of object allocations removed a huge volume of cache references that were almost all HITS. What remains is mostly compulsory misses, so the ratio rose even though every absolute number improved.\n\nThis is exactly the trap Tutorial 2 sets with its 2D-array demo, where the faster row-major version had a 9× worse miss rate. Lesson: always report absolute counts next to rates.",
    M, 4.85, 11.9, 1.6, 14);
  s.addNotes("This is a likely question, so we front-run it. If someone points at the miss rate and says the optimization hurt locality, the answer is in the absolute counts. It's the same lesson the tutorial deliberately teaches with the 2D array demo.");
}

// =========================================================== 10 pyflate defect
{
  const s = lightSlide("pyflate: an algorithmic defect, not just overhead", "Benchmark 2 — analysis");
  body(s, "Huffman decoding resolves each symbol by LINEARLY SCANNING the entire symbol table — up to 288 entries, three attribute loads each — once per symbol decoded.", M, 1.55, 11.9, 0.5, 14);

  s.addShape(pres.ShapeType.roundRect, { x: M, y: 2.2, w: 6.1, h: 1.85, rectRadius: 0.06,
    fill: { color: "24282F" } });
  s.addText("for x in self.table:\n    if cached_length != x.bits:\n        cached = field.snoopbits(x.bits)\n    if x.reverse_symbol == cached:\n        return x.code", {
    x: M + 0.3, y: 2.4, w: 5.6, h: 1.5, isTextBox: true, margin: 0,
    fontFace: MONO, fontSize: 11.5, color: "F0A080" });

  s.addShape(pres.ShapeType.roundRect, { x: 6.9, y: 2.2, w: 5.75, h: 1.85, rectRadius: 0.06,
    fill: { color: "24282F" } });
  s.addText("for bits in self._code_lengths:\n    code = by_len[bits].get(snoopbits(bits))\n    if code is not None:\n        return code", {
    x: 7.2, y: 2.5, w: 5.2, h: 1.3, isTextBox: true, margin: 0,
    fontFace: MONO, fontSize: 11.5, color: "8FD9C0" });

  s.addText("O(number of symbols) — up to 288", { x: M, y: 4.15, w: 6.1, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, bold: true, color: FLAME });
  s.addText("O(distinct code lengths) — at most 20", { x: 6.9, y: 4.15, w: 5.75, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, bold: true, color: TEAL });

  body(s, "The table is sorted by (bits, code) — canonical Huffman order — so the scan is exactly equivalent to probing each code length in ascending order. We precompute one dict per code length at table-construction time.",
    M, 4.6, 11.9, 0.7, 13.5);
  s.addText("The source file's own docstring admits it: “there is certainly some room for improvement in the Huffman bit-matcher.”", {
    x: M, y: 5.5, w: 11.9, h: 0.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13, italic: true, color: MUTED });
  s.addNotes("Two other fixes matter as much: move_to_front rebuilt a 256-entry list on every decoded symbol using three slices and a concatenation - replaced by one pop/insert. And bwt_transform sorted the whole block then ran 256 find() scans to compute what is just a cumulative histogram.");
}

// ======================================================= 11 we got it wrong
{
  const s = darkSlide();
  s.addText("We got this one wrong the first time", { x: M, y: 1.0, w: 9, h: 0.6, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 30, bold: true, color: WHITE });

  s.addShape(pres.ShapeType.roundRect, { x: M, y: 2.1, w: 3.5, h: 1.5, rectRadius: 0.08,
    fill: { color: "24282F" }, line: { color: "343A43", width: 1 } });
  s.addText("1.21×", { x: M, y: 2.35, w: 3.5, h: 0.7, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 34, bold: true, color: "9AA0A6", align: "center" });
  s.addText("Huffman only · debug build", { x: M, y: 3.0, w: 3.5, h: 0.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, color: "9AA0A6", align: "center" });

  s.addText("→", { x: 4.4, y: 2.5, w: 0.8, h: 0.7, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 32, color: FLAME, align: "center" });

  s.addShape(pres.ShapeType.roundRect, { x: 5.3, y: 2.1, w: 3.5, h: 1.5, rectRadius: 0.08,
    fill: { color: "2A2119" }, line: { color: FLAME, width: 1 } });
  s.addText("1.44×", { x: 5.3, y: 2.35, w: 3.5, h: 0.7, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 34, bold: true, color: FLAME, align: "center" });
  s.addText("+ bzip2 stages · debug build", { x: 5.3, y: 3.0, w: 3.5, h: 0.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, color: FLAME, align: "center" });

  s.addText("We assumed a decompressor is dominated by entropy decoding, fixed the Huffman scan, hit 1.21×, and had already cleared the 7 % requirement.", {
    x: M, y: 4.0, w: 8.2, h: 0.8, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 14, color: "C8CCD2" });
  s.addText("The profile disagreed. The file is a .bz2, so Huffman is one of FOUR pipeline stages — and the move-to-front and inverse-BWT stages were still untouched. Re-profiling after the first fix, instead of declaring victory, produced the remaining 19 %. (Release-interpreter final: 1.48×.)", {
    x: M, y: 4.85, w: 8.2, h: 1.1, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 14, color: WHITE });

  s.addShape(pres.ShapeType.roundRect, { x: 9.3, y: 2.1, w: 3.35, h: 3.4, rectRadius: 0.08,
    fill: { color: "24282F" }, line: { color: "343A43", width: 1 } });
  s.addText("The bzip2 pipeline", { x: 9.6, y: 2.35, w: 2.8, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 11, bold: true, color: FLAME, charSpacing: 1.5 });
  s.addText("1.  Huffman decode\n2.  Move-to-front + RLE\n3.  Inverse BWT\n4.  Final RLE", {
    x: 9.6, y: 2.75, w: 2.8, h: 1.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13.5, color: "C8CCD2", lineSpacingMultiple: 1.4 });
  s.addText("We had optimized only stage 1.", { x: 9.6, y: 4.55, w: 2.8, h: 0.6, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, italic: true, color: FLAME });
  s.addNotes("Be honest about this one - it's the most useful process lesson in the project. Clearing the requirement is not the same as being done. The second profile is a different problem from the first.");
}

// ========================================================== 12 pyflate result
{
  const s = lightSlide("pyflate: 1.48× faster, md5-verified", "Benchmark 2 — results");
  s.addText("1.48×", { x: M, y: 1.5, w: 2.6, h: 0.95, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 52, bold: true, color: TEAL });
  s.addText("1.12 s → 754 ms, release\n32.4 % less time\ndebug build said 1.44×", { x: M, y: 2.45, w: 2.8, h: 0.95, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13, color: MUTED });

  const rows = [
    [{ text: "perf counter · dbg", options: { bold: true } }, { text: "before", options: { bold: true } },
     { text: "after", options: { bold: true } }, { text: "change", options: { bold: true } }],
    ["Cycles", "37.92 B", "26.48 B", "1.43× fewer"],
    ["Instructions", "84.21 B", "59.63 B", "1.41× fewer"],
    ["IPC", "2.20", "2.25", "≈ flat"],
    ["Cache references", "49.6 M", "26.5 M", "1.87× fewer"],
  ];
  tbl(s, rows, 3.65, 1.5, 5.0, [1.75, 1.2, 1.2, 1.35], 11.5);

  card(s, 8.95, 1.5, 3.7, 2.1, "EAF5F5");
  s.addText("Same factor, twice", { x: 9.2, y: 1.7, w: 3.2, h: 0.3, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 15, bold: true, color: INK });
  s.addText("Cycles ÷1.43 and instructions ÷1.41 — the SAME number — with IPC flat at 2.2. Textbook removed work.",
    { x: 9.2, y: 2.05, w: 3.2, h: 1.4, isTextBox: true, margin: 0,
      fontFace: BFONT, fontSize: 12, color: INK });

  s.addText("What disappeared from the profile", { x: M, y: 3.95, w: 11.9, h: 0.35, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 17, bold: true, color: INK });
  const rows2 = [
    [{ text: "function", options: { bold: true } }, { text: "before", options: { bold: true } },
     { text: "after", options: { bold: true } }, { text: "why", options: { bold: true } }],
    ["_mask", "5.9 %", "gone", "655,017 calls recomputing (1<<n)-1 — precomputed table"],
    ["move_to_front", "9.8 %", "3.5 %", "rebuilt a 256-entry list per symbol → one pop/insert"],
    ["find_next_symbol", "15.4 %", "16.3 %", "per-call cost fell; still intrinsic — every symbol decodes once"],
  ];
  tbl(s, rows2, M, 4.35, 11.95, [2.2, 1.15, 1.05, 7.55], 11.5);
  s.addNotes("Note the third row is honest: find_next_symbol's share went UP even though it got faster, because the total shrank. Every symbol in the stream has to be decoded exactly once - that part is intrinsic to the algorithm.");
}

// ================================================ 12b interpreter correction
{
  const s = lightSlide("Which Python you measure changes the answer", "A correction from review");
  body(s, "We timed on python3-dbg because profiling needs its symbols. A reviewer pointed out that a speedup belongs on the release interpreter. Re-timing changed both answers — in opposite directions.",
    M, 1.55, 11.9, 0.6, 14);

  const rows = [
    [{ text: "benchmark", options: { bold: true } }, { text: "release python3", options: { bold: true } },
     { text: "debug python3-dbg", options: { bold: true } }, { text: "the debug build…", options: { bold: true } }],
    ["raytrace", "2.56×", "2.98×", "INFLATED the speedup"],
    ["pyflate", "1.48×", "1.44×", "UNDERSTATED the speedup"],
  ];
  tbl(s, rows, M, 2.3, 11.95, [2.4, 2.6, 2.75, 4.2], 13);

  card(s, M, 3.45, 5.8, 1.95, "FDF1EC");
  s.addText("raytrace — we removed allocations", { x: M + 0.3, y: 3.62, w: 5.2, h: 0.32, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 14.5, bold: true, color: FLAME });
  s.addText("In a debug build every allocation goes through a guard-byte allocator plus extra reference-count checks. We deleted ~330,000 Vector allocations per frame, so each one saved more there than it does in the release build.", {
    x: M + 0.3, y: 3.98, w: 5.2, h: 1.3, isTextBox: true, margin: 0, fontFace: BFONT, fontSize: 11.5, color: INK });

  card(s, 6.85, 3.45, 5.8, 1.95, "EAF5F5");
  s.addText("pyflate — we swapped Python for C", { x: 7.15, y: 3.62, w: 5.2, h: 0.32, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 14.5, bold: true, color: TEAL });
  s.addText("We replaced interpreted loops with dict.get, Counter and list.pop. A debug build compiles that C with assertions and little optimisation, so the code we switched TO is slower there. (Our best explanation of a 3 % gap.)", {
    x: 7.15, y: 3.98, w: 5.2, h: 1.3, isTextBox: true, margin: 0, fontFace: BFONT, fontSize: 11.5, color: INK });

  s.addText("The fingerprint was in our profiles all along: unresolved frames such as 0xfdfdfdfdfd000053 are built from 0xFD — FORBIDDENBYTE, the debug allocator's guard byte.", {
    x: M, y: 5.6, w: 11.9, h: 0.5, isTextBox: true, margin: 0, fontFace: BFONT, fontSize: 12.5, color: MUTED });
  s.addText("Profile with symbols. Measure with the interpreter you ship.", {
    x: M, y: 6.2, w: 11.9, h: 0.45, isTextBox: true, margin: 0, fontFace: HFONT, fontSize: 19, bold: true, color: INK });
  s.addNotes("An external review caught this, and it is better told than hidden. We had used the debug interpreter for timing because the project guide requires it for profiling - correct for flame graphs, wrong for a speedup. Own the second half too: we predicted pyflate would drop as well, and it rose. The table is the point - a debug build does not bias speedups in a fixed direction; it depends on whether the optimization removed allocations or replaced Python with C.");
}

// ======================================================== 13 why hardware
{
  const s = lightSlide("Optimizing changed the shape of the problem", "The case for hardware");
  body(s, "Software optimization did not just make raytrace faster — it changed what raytrace is made of.", M, 1.55, 11.9, 0.4, 15);

  card(s, M, 2.15, 5.75, 2.5);
  s.addText("Sphere.intersectionTime", { x: M + 0.3, y: 2.35, w: 5.1, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, bold: true, color: MUTED, charSpacing: 1 });
  s.addText("11.8 %   →   28.1 %", { x: M + 0.3, y: 2.7, w: 5.1, h: 0.7, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 28, bold: true, color: FLAME });
  s.addText("of runtime, before → after. It is now the single largest consumer, at 179,457 calls per frame.",
    { x: M + 0.3, y: 3.4, w: 5.1, h: 1.0, isTextBox: true, margin: 0, fontFace: BFONT, fontSize: 12.5, color: INK });

  card(s, 6.9, 2.15, 5.75, 2.5);
  s.addText("_PyEval_EvalFrameDefault", { x: 7.2, y: 2.35, w: 5.1, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, bold: true, color: MUTED, charSpacing: 1 });
  s.addText("28.1 %   →   34.1 %", { x: 7.2, y: 2.7, w: 5.1, h: 0.7, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 28, bold: true, color: TEAL });
  s.addText("of samples. Its absolute cost fell with everything else — but of what remains, a larger fraction is raw interpreter dispatch.",
    { x: 7.2, y: 3.4, w: 5.1, h: 1.0, isTextBox: true, margin: 0, fontFace: BFONT, fontSize: 12.5, color: INK });

  card(s, M, 4.9, 11.95, 1.5, "FDF1EC");
  s.addText("Once the removable software overhead is gone, what is left is irreducible in software.", {
    x: M + 0.35, y: 5.1, w: 11.2, h: 0.35, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 17, bold: true, color: INK });
  body(s, "That residue is fixed-shape, control-free arithmetic executed 179,457 times per frame — which is precisely the shape of problem a small fixed-function accelerator is good at. This is where hardware earns its place, and not before.",
    M + 0.35, 5.5, 11.2, 0.7, 13.5);
  s.addNotes("This is the hinge of the talk. Notice the interpreter share goes UP after optimization - that's not a regression, it's the floor becoming visible. We only argue for hardware once software has taken everything it can.");
}

// ======================================================= 14 RSIU architecture
{
  const s = lightSlide("Ray–Sphere Intersection Unit", "The accelerator");
  s.addText("The render loop is  for (o, s) in self.objects: o.intersectionTime(ray)  — ONE ray against MANY spheres.", {
    x: M, y: 1.5, w: 11.9, h: 0.35, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13.5, color: INK });
  s.addText("So we hold the ray stationary in registers and stream spheres past it, one per cycle — the same weight-stationary dataflow the TPU uses. Ray operands are fetched once per ray instead of once per sphere.", {
    x: M, y: 1.85, w: 11.9, h: 0.5, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13.5, color: MUTED });

  // host box
  s.addShape(pres.ShapeType.roundRect, { x: M, y: 2.6, w: 3.3, h: 3.2, rectRadius: 0.06,
    fill: { color: CARD }, line: { color: "C9CCD1", width: 1.25 } });
  s.addText("HOST  (CPython)", { x: M + 0.2, y: 2.78, w: 2.9, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 11, bold: true, color: MUTED, charSpacing: 1 });
  s.addText("Scene.rayColour\n\n① set_ray()  → MMIO BAR0\n② spheres    → DMA\n③ doorbell   → GO bit\n④ results    ← DMA\n⑤ poll done  ← MMIO", {
    x: M + 0.2, y: 3.15, w: 2.95, h: 2.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 11.5, color: INK, lineSpacingMultiple: 1.25 });

  // pcie arrow
  s.addShape(pres.ShapeType.rightArrow, { x: 4.05, y: 4.0, w: 0.85, h: 0.42, fill: { color: TEAL } });
  s.addText("PCIe", { x: 4.0, y: 3.62, w: 0.95, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 10, bold: true, color: TEAL, align: "center" });

  // device box
  s.addShape(pres.ShapeType.roundRect, { x: 5.05, y: 2.6, w: 7.6, h: 3.2, rectRadius: 0.06,
    fill: { color: "EAF5F5" }, line: { color: TEAL, width: 1.25 } });
  s.addText("RSIU ACCELERATOR", { x: 5.25, y: 2.78, w: 4, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 11, bold: true, color: TEAL, charSpacing: 1 });

  const stages = [
    "Ray registers (stationary)",
    "Sphere FIFO — 32 deep",
    "S1  cp = C − P            3 sub",
    "S2  8 × multiply",
    "S3  adder trees (Q32.32)",
    "S4  disc + hit test",
    "S5–S28  pipelined sqrt",
    "S29  t = v − √disc",
  ];
  let sy = 3.15;
  stages.forEach((t, i) => {
    const isPipe = i >= 2;
    s.addShape(pres.ShapeType.roundRect, {
      x: 5.3, y: sy, w: 7.1, h: 0.28, rectRadius: 0.03,
      fill: { color: isPipe ? CARD : "D6EBEB" }, line: { color: "BBD8D8", width: 0.75 },
    });
    s.addText(t, { x: 5.45, y: sy, w: 6.8, h: 0.28, isTextBox: true, margin: 0,
      fontFace: MONO, fontSize: 10, color: INK, valign: "middle" });
    sy += 0.325;
  });

  s.addText("No FSM · no stalls · no branches — a miss is a flag on the result, not a branch.  Little's Law: λ=1/cycle × W=30 cycles ⇒ 30 in flight, so the FIFOs are 32 deep.", {
    x: M, y: 6.0, w: 11.9, h: 0.6, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12.5, color: INK });
  s.addNotes("Point out the control logic slide-wide: there isn't any. That's deliberate - Lecture 5 says the systolic property is 'inputs processed every cycle, no control circuitry, most efficient silicon utilisation'. The price is that inputs must always be ready, which is what the FIFO guarantees, and Little's Law sizes it.");
}

// ======================================================== 15 verification
{
  const s = lightSlide("It compiles, it simulates, and it is correct", "Verification");
  body(s, "Simulated with Icarus Verilog against operands taken from the benchmark's REAL scene — the same camera and spheres bench_raytrace() constructs, with expected results computed in double precision.",
    M, 1.55, 11.9, 0.5, 14);

  s.addShape(pres.ShapeType.roundRect, { x: M, y: 2.2, w: 7.5, h: 2.85, rectRadius: 0.06,
    fill: { color: "24282F" } });
  s.addText("  [ ok ] sphere 0: HIT  t=18.744263  (err 59 LSB)\n  [ ok ] sphere 1..7: MISS\n  [ ok ] sphere 8: HIT  t=-2.004745  (err 1 LSB)\n  ------------------------------------------------\n  spheres issued   : 9  (on 9 consecutive cycles)\n  results received : 9\n  pipeline latency : 30 cycles\n  RESULT: PASS -- 9/9 correct, full throughput", {
    x: M + 0.3, y: 2.45, w: 7.0, h: 2.4, isTextBox: true, margin: 0,
    fontFace: MONO, fontSize: 11, color: "8FD9C0", lineSpacingMultiple: 1.2 });

  card(s, 8.4, 2.2, 4.25, 2.85);
  s.addText("What it proves", { x: 8.7, y: 2.4, w: 3.7, h: 0.3, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 15, bold: true, color: INK });
  bullets(s, [
    "hit/miss correct on all 9",
    "covers a negative-t case (camera inside a sphere)",
    "throughput verified, not assumed — 9 in, 9 out, in order",
  ], 8.7, 2.8, 3.7, 2.0, 12);

  s.addText("The specification does not require synthesis or physical testing — but a design that passes a self-checking simulation against the benchmark's own data is a much stronger claim than untested RTL.", {
    x: M, y: 5.35, w: 11.9, h: 0.7, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13.5, italic: true, color: MUTED });
  s.addNotes("If asked whether we synthesized it: no, and the spec explicitly doesn't require it. What we did do is verify functional correctness and the throughput claim in simulation, against real scene data rather than invented vectors.");
}

// ================================================ 16 the cancellation bug
{
  const s = darkSlide();
  s.addText("The first simulation failed — and the reason was worth having", {
    x: M, y: 0.85, w: 11.9, h: 0.6, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 27, bold: true, color: WHITE });

  s.addShape(pres.ShapeType.roundRect, { x: M, y: 1.85, w: 7.3, h: 1.35, rectRadius: 0.06,
    fill: { color: "24282F" } });
  s.addText("disc = r·r − (cp·cp − v·v)\n     =  4  − ( 402.44 − 400.02 )  =  1.58", {
    x: M + 0.3, y: 2.1, w: 6.7, h: 0.9, isTextBox: true, margin: 0,
    fontFace: MONO, fontSize: 14, color: "F0A080" });

  s.addText("Two large, nearly equal numbers cancel to a small one. That amplifies any pre-existing error in v by roughly 2v/disc ≈ 25×.", {
    x: M, y: 3.4, w: 7.3, h: 0.7, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 14, color: "C8CCD2" });
  s.addText("We were rounding v to Q16.16 BEFORE squaring it, so a 1 LSB truncation became a 67 LSB error in the answer. Keeping the dot products at full Q32.32 through the cancellation brought it to 59 LSB.", {
    x: M, y: 4.15, w: 7.3, h: 1.0, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 14, color: WHITE });

  s.addShape(pres.ShapeType.roundRect, { x: 8.3, y: 1.85, w: 4.35, h: 3.45, rectRadius: 0.08,
    fill: { color: "2A2119" }, line: { color: FLAME, width: 1 } });
  s.addText("How we know that's the cause", { x: 8.6, y: 2.1, w: 3.8, h: 0.3, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 11, bold: true, color: FLAME, charSpacing: 1 });
  s.addText("Sphere 8 — where the camera sits INSIDE the sphere, so no cancellation occurs —\n\nis accurate to 1 LSB.", {
    x: 8.6, y: 2.5, w: 3.8, h: 1.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13.5, color: WHITE });
  s.addText("Same datapath, same format. The only difference is whether the subtraction cancels.", {
    x: 8.6, y: 4.0, w: 3.8, h: 1.0, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12, color: "C8CCD2" });

  s.addText("Remaining error traced to input quantisation of the ray direction. The fix: a direction is a UNIT vector, so Q16.16 wastes 15 integer bits on a value that can never exceed 1 — Q2.30 would buy 14 fractional bits at zero cost.", {
    x: M, y: 5.55, w: 11.9, h: 0.8, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 13, color: "9AA0A6" });
  s.addNotes("Resist the urge to widen the tolerance until a test passes. We found the mechanism, fixed what was fixable, and can point to a control case that confirms the diagnosis. The Q2.30 observation is the kind of thing they may ask about: choose the fixed-point format per operand from its known range.");
}

// ============================================================== 17 amdahl
{
  const s = lightSlide("The honest ceiling", "Expected performance");
  card(s, M, 1.6, 3.75, 2.0, "EAF5F5");
  s.addText("~88 ms  →  ~1 ms", { x: M + 0.25, y: 1.85, w: 3.3, h: 0.5, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 21, bold: true, color: TEAL });
  s.addText("time spent in intersectionTime, replaced by 194,790 cycles at 200 MHz", {
    x: M + 0.25, y: 2.4, w: 3.3, h: 1.0, isTextBox: true, margin: 0, fontFace: BFONT, fontSize: 12, color: INK });

  card(s, 4.65, 1.6, 3.75, 2.0, "FDF1EC");
  s.addText("1.39×", { x: 4.9, y: 1.8, w: 3.3, h: 0.65, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 34, bold: true, color: FLAME });
  s.addText("maximum end-to-end speedup.  S = 1 / (1 − 0.281)", {
    x: 4.9, y: 2.45, w: 3.3, h: 0.9, isTextBox: true, margin: 0, fontFace: BFONT, fontSize: 12, color: INK });

  card(s, 8.7, 1.6, 3.95, 2.0);
  s.addText("A wider unit is pointless", { x: 8.95, y: 1.82, w: 3.5, h: 0.3, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 15, bold: true, color: INK });
  s.addText("A 9-wide array would cut 0.97 ms to 0.077 ms — and change the end-to-end result by well under 1 %.",
    { x: 8.95, y: 2.2, w: 3.5, h: 1.2, isTextBox: true, margin: 0, fontFace: BFONT, fontSize: 12, color: INK });

  s.addText("Making the arithmetic free does not make the program fast.", {
    x: M, y: 3.95, w: 11.9, h: 0.45, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 21, bold: true, color: INK });
  body(s, "The accelerator removes essentially all of the geometry cost, and Amdahl still caps the benefit at 1.39×, because 72 % of the program is other Python. Once you have offloaded a hotspot, the bottleneck is what you did NOT offload.\n\nSo the way forward is not more multipliers — it is a LARGER offload. Moving the whole traversal loop (rayColour 10.1 %, _lightIsVisible 6.2 %, the half-space test 2.3 %) raises the offloadable fraction to ~47 % and the ceiling to 1.88×. That is a data-movement argument, not an arithmetic one.",
    M, 4.4, 11.9, 1.7, 14);
  s.addText("Caveat we state in the report: cProfile inflates frequently-called functions, so 28.1 % is likely an over-estimate — which makes 1.39× optimistic, not conservative.", {
    x: M, y: 6.25, w: 11.9, h: 0.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 11.5, italic: true, color: MUTED });
  s.addNotes("The most valuable slide for a viva. We could have claimed a big speedup; instead we bounded it honestly and explained why building something more impressive would be wasted silicon. Lecture 1's argument applies: verification is the limiting cost, so build the smallest thing that removes the bottleneck.");
}

// ========================================================== 18 trade-offs
{
  const s = lightSlide("Performance, area and power", "Trade-offs");
  const cols = [
    ["Area", TEAL, "9 signed 32×32 multipliers (~9 DSP blocks)\n24 sqrt stages ≈ 2,400 flip-flops\n+ ~1,500 for datapath and delay lines\ntwo 32-deep FIFOs\n\nWell under 1 % of a mid-range FPGA."],
    ["The expensive decision", FLAME, "Squaring v at full width to survive the cancellation turns one 32×32 multiply into a 64×64 — 4× the multiplier area.\n\nQ2.30 ray directions would let it revert to 32×32 AND improve accuracy: the better numerical choice is also the cheaper one."],
    ["Power & frequency", INK, "No caches, no branch predictor, no register file — the three biggest consumers in a general-purpose core. Every flip-flop toggles for the computation.\n\nThroughput is 1/cycle regardless of depth, so frequency scales it linearly. Latency (30 cycles = 150 ns at 200 MHz) is hidden by the FIFO."],
  ];
  let cx = M;
  cols.forEach((c) => {
    card(s, cx, 1.6, 3.87, 4.2);
    s.addText(c[0], { x: cx + 0.28, y: 1.82, w: 3.3, h: 0.35, isTextBox: true, margin: 0,
      fontFace: HFONT, fontSize: 17, bold: true, color: c[1] });
    s.addText(c[2], { x: cx + 0.28, y: 2.28, w: 3.3, h: 3.3, isTextBox: true, margin: 0,
      fontFace: BFONT, fontSize: 11.5, color: INK, lineSpacingMultiple: 1.15 });
    cx += 4.04;
  });
  s.addText("Fixed vs floating point: FP32 would remove the range and cancellation concerns and match Python exactly — at the cost of a much larger multiplier, an FP adder with normalisation, and a far more complex square root. For a bounded scene, fixed point is the better engineering choice, and we quantified exactly what it costs.", {
    x: M, y: 6.0, w: 11.9, h: 0.7, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 12.5, color: MUTED });
  s.addNotes("If they push on why not floating point - the answer is the scene is bounded, we measured the error at 9e-4 absolute which is 4.8e-5 relative on a value that ends up quantised to 256 colour levels, and FP32 would cost substantially more area for no visible benefit.");
}

// ============================================================ 19 conclusions
{
  const s = darkSlide();
  s.addText("What we take away", { x: M, y: 0.8, w: 8, h: 0.6, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 32, bold: true, color: WHITE });

  const pts = [
    ["Both benchmarks beat the requirement", "2.56× and 1.48× on the release interpreter, with byte-identical output verified before any number was recorded."],
    ["The speedups are removed work", "Cycles and instructions fall by the same factor with IPC flat, and page faults are unchanged — so it is compute, not artefacts."],
    ["Optimizing changes the shape of the problem", "intersectionTime went 11.8 % → 28.1 % and interpreter dispatch 28 % → 34 %. What remains is the floor software cannot reach."],
    ["The accelerator's limit is Amdahl, not arithmetic", "One pipeline makes the geometry free; the ceiling is still 1.39×, and a wider unit would change nothing."],
    ["Two workloads, two different hardware answers", "raytrace is regular and suits a control-free systolic pipeline. pyflate's variable-length decode is serially dependent by construction — the same method, an entirely different conclusion."],
  ];
  let y = 1.65;
  pts.forEach((p, i) => {
    numDot(s, M, y + 0.02, i + 1, i === 4 ? TEAL : FLAME);
    s.addText(p[0], { x: M + 0.55, y, w: 11.3, h: 0.3, isTextBox: true, margin: 0,
      fontFace: BFONT, fontSize: 14.5, bold: true, color: WHITE });
    s.addText(p[1], { x: M + 0.55, y: y + 0.32, w: 11.3, h: 0.55, isTextBox: true, margin: 0,
      fontFace: BFONT, fontSize: 12.5, color: "9AA0A6" });
    y += 1.0;
  });
  s.addNotes("Close on point 5 - it's the strongest argument that we understood the material rather than followed a recipe. Same methodology, two workloads, and the honest conclusion for one of them is that the simple accelerator pattern does not apply.");
}

// ============================================================= 20 thank you
{
  const s = darkSlide();
  s.addText("Questions", { x: M, y: 2.5, w: 8, h: 1.0, isTextBox: true, margin: 0,
    fontFace: HFONT, fontSize: 44, bold: true, color: WHITE });
  s.addText("Code, reports, RTL and every measurement artefact are in the repository.", {
    x: M, y: 3.6, w: 9, h: 0.4, isTextBox: true, margin: 0,
    fontFace: BFONT, fontSize: 15, color: FLAME });
  s.addText("bash script_raytrace.sh   ·   bash script_pyflate.sh   ·   bash scripts/run_hw_sim.sh", {
    x: M, y: 4.3, w: 11, h: 0.4, isTextBox: true, margin: 0,
    fontFace: MONO, fontSize: 13, color: "9AA0A6" });
  s.addNotes("Backup facts if asked: headline timings on release python3 (2.56x, 1.48x), profiling on python3-dbg (2.98x, 1.44x there); measurements all inside the QEMU guest; flame graphs sampled on cpu-clock because PEBS isn't virtualised; the Q16.16 worst-case error is 9.0e-4 absolute, 4.8e-5 relative.");
}

pres.writeFile({ fileName: OUT }).then(() => console.log("wrote " + OUT));
