// ===========================================================================
// ray_sphere_unit.v -- Ray-Sphere Intersection Unit (RSIU) datapath
//
// Accelerates the hottest function of the pyperformance `raytrace` benchmark:
//
//     def intersectionTime(self, ray):            # Sphere
//         cx = centre.x - ray.point.x   (and y, z)
//         v  = cx*rvx + cy*rvy + cz*rvz
//         disc = r*r - (cx*cx + cy*cy + cz*cz - v*v)
//         if disc < 0: return None                # miss
//         return v - sqrt(disc)                   # hit, t
//
// The profile showed this runs once per scene object per ray -- including every
// shadow ray -- so it dominates the render. Crucially the loop is
//
//     for (o, s) in self.objects: o.intersectionTime(ray)
//
// i.e. ONE ray tested against MANY spheres. So we hold the ray stationary in
// registers and stream spheres through, one per cycle. This is the same
// dataflow the TPU uses for weights ("weights preloaded to array, and then
// inputs are streamed", Lecture 5) and it means the ray operands are fetched
// once instead of once per sphere.
//
// The datapath is straight-line: 3 subtractions, 8 multiplications, an adder
// tree, one comparison and one square root. There is no data-dependent control
// anywhere -- the miss case is a flag on the result, not a branch -- so the
// pipeline never stalls and never mispredicts.
//
// NUMERIC FORMAT -- Q16.16 signed fixed point (32-bit): range +/-32768 with a
// resolution of 2^-16 = 1.5e-5. The benchmark's scene fits in +/-16 units, so
// this leaves a very large margin. Products are kept at full 64-bit width
// (Q32.32) and only narrowed after the adder trees, so no intermediate rounds
// away. See hw/README.md for the precision trade-off discussion.
// ===========================================================================
`timescale 1ns / 1ps
`default_nettype none

module ray_sphere_unit #(
    parameter DW     = 32,          // Q16.16 operand width
    parameter FRAC   = 16,          // fractional bits
    parameter IDW    = 8,           // sphere tag width
    parameter SQRT_W = 24           // square-root result width
) (
    input  wire                    clk,
    input  wire                    rst_n,

    // ---- stationary operand: the ray (loaded once per ray) ----------------
    input  wire                    ray_load,
    input  wire signed [DW-1:0]    ray_px,
    input  wire signed [DW-1:0]    ray_py,
    input  wire signed [DW-1:0]    ray_pz,
    input  wire signed [DW-1:0]    ray_vx,   // must be pre-normalised
    input  wire signed [DW-1:0]    ray_vy,
    input  wire signed [DW-1:0]    ray_vz,

    // ---- streaming operand: one sphere per cycle --------------------------
    input  wire                    sph_valid,
    input  wire [IDW-1:0]          sph_id,
    input  wire signed [DW-1:0]    sph_cx,
    input  wire signed [DW-1:0]    sph_cy,
    input  wire signed [DW-1:0]    sph_cz,
    input  wire signed [DW-1:0]    sph_r,

    // ---- results, in the same order the spheres were presented ------------
    output wire                    res_valid,
    output wire [IDW-1:0]          res_id,
    output wire                    res_hit,  // 1 = intersects (disc >= 0)
    output wire signed [DW-1:0]    res_t     // intersection time, Q16.16
);

    localparam AW = 2*DW;           // 64-bit accumulator width

    // =======================================================================
    // Stationary ray registers
    // =======================================================================
    reg signed [DW-1:0] px_q, py_q, pz_q, vx_q, vy_q, vz_q;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            px_q <= 0; py_q <= 0; pz_q <= 0;
            vx_q <= 0; vy_q <= 0; vz_q <= 0;
        end else if (ray_load) begin
            px_q <= ray_px; py_q <= ray_py; pz_q <= ray_pz;
            vx_q <= ray_vx; vy_q <= ray_vy; vz_q <= ray_vz;
        end
    end

    // =======================================================================
    // S1 -- cp = sphere.centre - ray.point
    // =======================================================================
    reg                 s1_vld;
    reg [IDW-1:0]       s1_id;
    reg signed [DW-1:0] s1_cx, s1_cy, s1_cz, s1_r;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            s1_vld <= 1'b0; s1_id <= 0;
            s1_cx <= 0; s1_cy <= 0; s1_cz <= 0; s1_r <= 0;
        end else begin
            s1_vld <= sph_valid;
            s1_id  <= sph_id;
            s1_cx  <= sph_cx - px_q;
            s1_cy  <= sph_cy - py_q;
            s1_cz  <= sph_cz - pz_q;
            s1_r   <= sph_r;
        end
    end

    // =======================================================================
    // S2 -- eight parallel multiplies (the two dot products, plus r*r)
    //       cp.rv  ->  v          cp.cp  ->  cpcp          r*r
    // =======================================================================
    reg                 s2_vld;
    reg [IDW-1:0]       s2_id;
    reg signed [AW-1:0] s2_pv0, s2_pv1, s2_pv2;   // cp .* rv
    reg signed [AW-1:0] s2_pc0, s2_pc1, s2_pc2;   // cp .* cp
    reg signed [AW-1:0] s2_rr;                    // r * r

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            s2_vld <= 1'b0; s2_id <= 0;
            s2_pv0 <= 0; s2_pv1 <= 0; s2_pv2 <= 0;
            s2_pc0 <= 0; s2_pc1 <= 0; s2_pc2 <= 0; s2_rr <= 0;
        end else begin
            s2_vld <= s1_vld;
            s2_id  <= s1_id;
            s2_pv0 <= s1_cx * vx_q;
            s2_pv1 <= s1_cy * vy_q;
            s2_pv2 <= s1_cz * vz_q;
            s2_pc0 <= s1_cx * s1_cx;
            s2_pc1 <= s1_cy * s1_cy;
            s2_pc2 <= s1_cz * s1_cz;
            s2_rr  <= s1_r  * s1_r;
        end
    end

    // =======================================================================
    // S3 -- adder trees, then narrow Q32.32 back to Q16.16
    // =======================================================================
    reg                 s3_vld;
    reg [IDW-1:0]       s3_id;
    reg signed [AW-1:0] s3_v;       // v    = cp . rv
    reg signed [AW-1:0] s3_cpcp;    // cpcp = cp . cp
    reg signed [AW-1:0] s3_rr;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            s3_vld <= 1'b0; s3_id <= 0;
            s3_v <= 0; s3_cpcp <= 0; s3_rr <= 0;
        end else begin
            s3_vld  <= s2_vld;
            s3_id   <= s2_id;
            s3_v    <= (s2_pv0 + s2_pv1 + s2_pv2) >>> FRAC;
            s3_cpcp <= (s2_pc0 + s2_pc1 + s2_pc2) >>> FRAC;
            s3_rr   <= s2_rr >>> FRAC;
        end
    end

    // =======================================================================
    // S4 -- disc = r*r - (cp.cp - v*v)   and the hit test
    // =======================================================================
    wire signed [AW-1:0] vv_full = (s3_v * s3_v) >>> FRAC;
    wire signed [AW-1:0] disc_c  = s3_rr - (s3_cpcp - vv_full);

    reg                  s4_vld;
    reg [IDW-1:0]        s4_id;
    reg                  s4_hit;
    reg signed [DW-1:0]  s4_v;
    reg [2*SQRT_W-1:0]   s4_radicand;

    // Q16.16 sqrt via integer sqrt of (value << FRAC): sqrt(v) = isqrt(v*2^16).
    // The widening to 2*SQRT_W is written out explicitly rather than relying on
    // Verilog's context-determined operand width for "<<", so the top FRAC bits
    // cannot be shifted away by a tool that sizes the shift differently.
    wire [AW-1:0]       disc_u     = disc_c[AW-1] ? {AW{1'b0}} : disc_c;
    wire [2*SQRT_W-1:0] radicand_w =
             {{(2*SQRT_W-DW){1'b0}}, disc_u[DW-1:0]} << FRAC;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            s4_vld <= 1'b0; s4_id <= 0; s4_hit <= 1'b0;
            s4_v <= 0; s4_radicand <= 0;
        end else begin
            s4_vld      <= s3_vld;
            s4_id       <= s3_id;
            s4_hit      <= ~disc_c[AW-1];               // disc >= 0
            s4_v        <= s3_v[DW-1:0];
            s4_radicand <= radicand_w;
        end
    end

    // =======================================================================
    // S5..S5+SQRT_W -- pipelined square root
    // =======================================================================
    wire              sq_vld;
    wire [SQRT_W-1:0] sq_root;

    fxp_sqrt #(.OUT_W(SQRT_W)) u_sqrt (
        .clk        (clk),
        .rst_n      (rst_n),
        .in_valid   (s4_vld),
        .in_radicand(s4_radicand),
        .out_valid  (sq_vld),
        .out_root   (sq_root)
    );

    // The square root takes SQRT_W+1 cycles. v, the tag and the hit flag must
    // arrive with it, so they ride a matched delay line -- the standard way to
    // keep a straight-line pipeline in step without any handshaking.
    localparam LAT = SQRT_W + 1;

    reg [IDW-1:0]       d_id  [0:LAT-1];
    reg                 d_hit [0:LAT-1];
    reg signed [DW-1:0] d_v   [0:LAT-1];

    integer j;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            for (j = 0; j < LAT; j = j + 1) begin
                d_id[j]  <= 0;
                d_hit[j] <= 1'b0;
                d_v[j]   <= 0;
            end
        end else begin
            d_id[0]  <= s4_id;
            d_hit[0] <= s4_hit;
            d_v[0]   <= s4_v;
            for (j = 1; j < LAT; j = j + 1) begin
                d_id[j]  <= d_id[j-1];
                d_hit[j] <= d_hit[j-1];
                d_v[j]   <= d_v[j-1];
            end
        end
    end

    // =======================================================================
    // Result: t = v - sqrt(disc)
    // =======================================================================
    assign res_valid = sq_vld;
    assign res_id    = d_id[LAT-1];
    assign res_hit   = d_hit[LAT-1];
    assign res_t     = d_v[LAT-1] - $signed({{(DW-SQRT_W){1'b0}}, sq_root});

endmodule

`default_nettype wire
