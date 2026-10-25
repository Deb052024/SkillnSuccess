// Lab D1: 4-bit counter with synchronous reset
module counter4 (
    input  wire       clk,
    input  wire       rst,
    output reg  [3:0] count
);
  always @(posedge clk) begin
    if (rst)
      count <= 4'd0;
    else
      count <= count + 1'b1;
  end
endmodule
