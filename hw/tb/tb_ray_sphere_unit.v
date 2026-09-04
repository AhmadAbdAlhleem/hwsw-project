// ===========================================================================
// tb_ray_sphere_unit.v -- self-checking testbench for the RSIU datapath.
//
// Loads the raytrace benchmark's real camera ray, streams the benchmark's real
// spheres through the unit back-to-back (one per cycle), and checks every
// result against the double-precision reference computed by hw/tb/gen_vectors.py.
//
// It verifies three things:
//   1. functional correctness  -- hit/miss flag and t for every sphere
//   2. numerical accuracy      -- |t_hw - t_double| within tolerance
//   3. throughput              -- N spheres issued on N consecutive cycles all
//                                 produce N results, in order (no stalls)
//
//   iverilog -g2005 -o rsiu_tb hw/rtl/fxp_sqrt.v hw/rtl/ray_sphere_unit.v \
//                              hw/tb/tb_ray_sphere_unit.v
//   vvp rsiu_tb
// ===========================================================================
`timescale 1ns / 1ps

module tb_ray_sphere_unit;

    localparam DW     = 32;
    localparam FRAC   = 16;
    localparam IDW    = 8;
    localparam SQRT_W = 24;

    // Q16.16 LSB = 1.526e-05. The datapath truncates after each of the three
    // narrowing shifts, so allow a small multiple of an LSB; the test prints
    // the worst error actually observed.
    localparam signed [31:0] TOL = 32'sd64;   // 64 LSB = 9.8e-4

    reg clk = 1'b0;
    reg rst_n = 1'b0;
    always #5 clk = ~clk;                     // 100 MHz

    `include "vectors.vh"

    reg                 ray_load = 1'b0;
    reg                 sph_valid = 1'b0;
    reg [IDW-1:0]       sph_id = 0;
    reg signed [DW-1:0] sph_cx = 0, sph_cy = 0, sph_cz = 0, sph_r = 0;

    wire                res_valid;
    wire [IDW-1:0]      res_id;
    wire                res_hit;
    wire signed [DW-1:0] res_t;

    ray_sphere_unit #(
        .DW(DW), .FRAC(FRAC), .IDW(IDW), .SQRT_W(SQRT_W)
    ) dut (
        .clk(clk), .rst_n(rst_n),
        .ray_load(ray_load),
        .ray_px(RAY_PX), .ray_py(RAY_PY), .ray_pz(RAY_PZ),
        .ray_vx(RAY_VX), .ray_vy(RAY_VY), .ray_vz(RAY_VZ),
        .sph_valid(sph_valid), .sph_id(sph_id),
        .sph_cx(sph_cx), .sph_cy(sph_cy), .sph_cz(sph_cz), .sph_r(sph_r),
        .res_valid(res_valid), .res_id(res_id),
        .res_hit(res_hit), .res_t(res_t)
    );

    integer i;
    integer errors = 0;
    integer n_res  = 0;
    integer issue_cycle = 0;
    integer first_res_cycle = 0;
    integer cycle = 0;
    reg signed [31:0] worst_err = 0;

    // free-running cycle counter, used to measure latency and throughput
    always @(posedge clk) cycle <= cycle + 1;

    // ---- result checker ---------------------------------------------------
    reg signed [31:0] diff;
    always @(posedge clk) begin
        if (rst_n && res_valid) begin
            if (n_res == 0) first_res_cycle = cycle;
            if (res_id !== n_res[IDW-1:0]) begin
                $display("  [FAIL] result %0d arrived out of order (id=%0d)", n_res, res_id);
                errors = errors + 1;
            end
            if (res_hit !== EXP_HIT[n_res]) begin
                $display("  [FAIL] sphere %0d: hit=%b expected %b",
                         n_res, res_hit, EXP_HIT[n_res]);
                errors = errors + 1;
            end else if (res_hit) begin
                diff = res_t - $signed(EXP_T[n_res]);
                if (diff < 0) diff = -diff;
                if (diff > worst_err) worst_err = diff;
                if (diff > TOL) begin
                    $display("  [FAIL] sphere %0d: t=%0d expected %0d (err %0d LSB)",
                             n_res, res_t, $signed(EXP_T[n_res]), diff);
                    errors = errors + 1;
                end else begin
                    $display("  [ ok ] sphere %0d: HIT  t=%f (ref %f, err %0d LSB)",
                             n_res, $itor(res_t) / 65536.0,
                             $itor($signed(EXP_T[n_res])) / 65536.0, diff);
                end
            end else begin
                $display("  [ ok ] sphere %0d: MISS", n_res);
            end
            n_res = n_res + 1;
        end
    end

    // ---- stimulus ---------------------------------------------------------
    initial begin
        $display("============================================================");
        $display("  RSIU testbench -- real raytrace scene, Q16.16 datapath");
        $display("============================================================");
        load_vectors;

        repeat (4) @(posedge clk);
        rst_n = 1'b1;
        @(posedge clk);

        // load the stationary ray once
        ray_load <= 1'b1;
        @(posedge clk);
        ray_load <= 1'b0;
        @(posedge clk);

        // stream every sphere back-to-back: one per cycle, no gaps
        issue_cycle = cycle;
        for (i = 0; i < N_SPHERES; i = i + 1) begin
            sph_valid <= 1'b1;
            sph_id    <= i[IDW-1:0];
            sph_cx    <= SPH_CX[i];
            sph_cy    <= SPH_CY[i];
            sph_cz    <= SPH_CZ[i];
            sph_r     <= SPH_R[i];
            @(posedge clk);
        end
        sph_valid <= 1'b0;

        // drain the pipeline
        repeat (SQRT_W + 32) @(posedge clk);

        $display("------------------------------------------------------------");
        $display("  spheres issued      : %0d (on %0d consecutive cycles)",
                 N_SPHERES, N_SPHERES);
        $display("  results received    : %0d", n_res);
        $display("  pipeline latency    : %0d cycles", first_res_cycle - issue_cycle);
        $display("  worst |error|       : %0d LSB (%e)",
                 worst_err, $itor(worst_err) / 65536.0);

        if (n_res !== N_SPHERES) begin
            $display("  [FAIL] expected %0d results, got %0d", N_SPHERES, n_res);
            errors = errors + 1;
        end

        $display("------------------------------------------------------------");
        if (errors == 0)
            $display("  RESULT: PASS -- %0d/%0d spheres correct, full throughput",
                     n_res, N_SPHERES);
        else
            $display("  RESULT: FAIL -- %0d error(s)", errors);
        $display("============================================================");
        $finish;
    end

    initial begin
        #200000;
        $display("  [FAIL] timeout");
        $finish;
    end

endmodule
