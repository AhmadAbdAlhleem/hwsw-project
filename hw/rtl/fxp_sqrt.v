// ===========================================================================
// fxp_sqrt.v -- fully pipelined fixed-point square root (non-restoring)
//
// Computes root = floor(sqrt(radicand)) for an unsigned IN_W-bit radicand,
// producing an OUT_W-bit result, where IN_W = 2*OUT_W.
//
// One result-bit is resolved per pipeline stage, so the unit accepts a new
// radicand EVERY cycle and produces a new root every cycle after a fixed
// OUT_W-cycle latency. That constant-rate, control-free behaviour is what
// Lecture 5 calls the systolic property: "circuit inputs are processed on each
// cycle, no control circuitry".
//
// Algorithm (classic non-restoring / "digit recurrence" square root). At each
// step two more radicand bits are brought down into the remainder and we test
// whether the next root bit can be a 1:
//
//     rem   = (rem << 2) | next_two_bits_of_radicand
//     trial = (root << 2) | 1
//     if (rem >= trial) { rem -= trial;  root = (root << 1) | 1; }
//     else              {                root = (root << 1);     }
//
// Each stage is a compare, a conditional subtract and two shifts -- no
// multiplier and no divider, which is why this is the cheap way to get a square
// root in hardware.
//
// Fixed-point use: to obtain sqrt of a Q16.16 value in Q16.16 format, present
// (value_raw << 16) as the radicand. Then IN_W = 48 and OUT_W = 24, and the
// low 16 bits of the 24-bit root are the fractional part.
//     sqrt(v) in Q16.16 = isqrt(v_raw * 2^16)
// ===========================================================================
`timescale 1ns / 1ps
`default_nettype none

module fxp_sqrt #(
    parameter OUT_W = 24,            // result width; radicand is 2*OUT_W wide
    parameter IN_W  = 2 * OUT_W
) (
    input  wire              clk,
    input  wire              rst_n,

    // input side (no back-pressure: the pipeline never stalls)
    input  wire              in_valid,
    input  wire [IN_W-1:0]   in_radicand,

    // output side, IN_W/2 cycles later
    output wire              out_valid,
    output wire [OUT_W-1:0]  out_root
);

    // Stage registers. Index 0 is the input capture stage, index OUT_W is the
    // final result. rem needs to hold at most 2*root+1, hence OUT_W+2 bits.
    reg [IN_W-1:0]   x_r    [0:OUT_W];
    reg [OUT_W-1:0]  root_r [0:OUT_W];
    reg [OUT_W+1:0]  rem_r  [0:OUT_W];
    reg              vld_r  [0:OUT_W];

    integer k;

    // ---- stage 0: capture -------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            x_r[0]    <= {IN_W{1'b0}};
            root_r[0] <= {OUT_W{1'b0}};
            rem_r[0]  <= {(OUT_W+2){1'b0}};
            vld_r[0]  <= 1'b0;
        end else begin
            x_r[0]    <= in_radicand;
            root_r[0] <= {OUT_W{1'b0}};
            rem_r[0]  <= {(OUT_W+2){1'b0}};
            vld_r[0]  <= in_valid;
        end
    end

    // ---- stages 1..OUT_W: one result bit each -----------------------------
    genvar i;
    generate
        for (i = 0; i < OUT_W; i = i + 1) begin : sqrt_stage
            // bring down the two most significant remaining radicand bits
            wire [1:0]       two_bits  = x_r[i][IN_W-1 -: 2];
            wire [OUT_W+1:0] rem_shift = {rem_r[i][OUT_W-1:0], two_bits};
            wire [OUT_W+1:0] trial     = {root_r[i][OUT_W-2:0], 2'b01};
            wire             fits      = (rem_shift >= trial);

            always @(posedge clk or negedge rst_n) begin
                if (!rst_n) begin
                    x_r[i+1]    <= {IN_W{1'b0}};
                    root_r[i+1] <= {OUT_W{1'b0}};
                    rem_r[i+1]  <= {(OUT_W+2){1'b0}};
                    vld_r[i+1]  <= 1'b0;
                end else begin
                    x_r[i+1]    <= x_r[i] << 2;
                    root_r[i+1] <= {root_r[i][OUT_W-2:0], fits};
                    rem_r[i+1]  <= fits ? (rem_shift - trial) : rem_shift;
                    vld_r[i+1]  <= vld_r[i];
                end
            end
        end
    endgenerate

    assign out_root  = root_r[OUT_W];
    assign out_valid = vld_r[OUT_W];

    // Silence "unused" lint on the fully-shifted-out radicand copy.
    // verilator lint_off UNUSED
    wire _unused = &{1'b0, x_r[OUT_W], 1'b0};
    // verilator lint_on UNUSED

endmodule

`default_nettype wire
