`timescale 1ns/1ps
module tb_counter4;
  reg clk = 0, rst = 1;
  wire [3:0] count;
  integer errors = 0, cycle = 0, sample = 0;
  counter4 dut(.clk(clk), .rst(rst), .count(count));
  always #5 clk = ~clk;               // 100 MHz clock (10 ns period)
  initial begin
    $dumpfile("counter4.vcd"); $dumpvars(0, tb_counter4);
    $display("cycle,rst,count");
    repeat (2) @(posedge clk);         // hold reset for 2 cycles
    #1 rst = 0;
    repeat (20) @(posedge clk);        // 20 counts -> must roll over 15 -> 0
    #1 rst = 1;                        // mid-run reset
    @(posedge clk); #1 rst = 0;
    repeat (3) @(posedge clk);
    #2;
    if (errors == 0) $display("RESULT: PASS - reset and rollover verified (%0d checks)", cycle);
    else $display("RESULT: FAIL - %0d errors", errors);
    $finish;
  end
  // self-checking: compare with expected value after every edge
  always @(posedge clk) begin
    #1;
    sample = sample + 1; $display("%0d,%0d,%0d", sample, rst, count);
  end
  reg [3:0] model = 0;
  always @(posedge clk) begin
    model <= rst ? 4'd0 : model + 1'b1;
  end
  always @(negedge clk) begin
    cycle = cycle + 1;
    if (count !== model) begin
      errors = errors + 1;
      $display("MISMATCH at cycle %0d: count=%0d expected=%0d", cycle, count, model);
    end
  end
endmodule
