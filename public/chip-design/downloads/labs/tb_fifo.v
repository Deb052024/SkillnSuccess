`timescale 1ns/1ps
// Self-checking testbench with a reference queue model
module tb_fifo;
  reg clk = 0, rst = 1, wr_en = 0, rd_en = 0;
  reg [7:0] din = 0;
  wire [7:0] dout; wire full, empty;
  fifo dut(.clk(clk), .rst(rst), .wr_en(wr_en), .rd_en(rd_en), .din(din), .dout(dout), .full(full), .empty(empty));
  always #5 clk = ~clk;
  reg [7:0] model [0:15]; integer head = 0, tail = 0, errors = 0, i;
  task push(input [7:0] v); begin
    @(negedge clk); wr_en = 1; din = v;
    if (!full) begin model[tail % 16] = v; tail = tail + 1; end
    $display("WRITE %0d  (full=%0b before write)", v, full);
    @(negedge clk); wr_en = 0;
  end endtask
  task pop; reg [7:0] exp; begin
    @(negedge clk); rd_en = 1;
    @(negedge clk); rd_en = 0;
    exp = model[head % 16]; head = head + 1;
    if (dout !== exp) begin errors = errors + 1; $display("READ  %0d  expected %0d  <-- MISMATCH", dout, exp); end
    else $display("READ  %0d  expected %0d  ok", dout, exp);
  end endtask
  initial begin
    $dumpfile("fifo.vcd"); $dumpvars(0, tb_fifo);
    repeat (2) @(negedge clk); rst = 0;
    // Boundary test: write 5 items into a 4-deep FIFO (one too many)
    for (i = 1; i <= 5; i = i + 1) push(i * 10);
    // Read back the 4 items that should be stored
    for (i = 0; i < 4; i = i + 1) pop;
    if (errors == 0) $display("RESULT: PASS - full-boundary test passed");
    else $display("RESULT: FAIL - %0d mismatches at the full boundary", errors);
    $finish;
  end
endmodule
