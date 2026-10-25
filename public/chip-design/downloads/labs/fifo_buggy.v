// Lab D2: 4-entry synchronous FIFO -- contains ONE deliberate bug.
module fifo #(parameter W = 8, D = 4) (
    input  wire         clk, rst,
    input  wire         wr_en, rd_en,
    input  wire [W-1:0] din,
    output reg  [W-1:0] dout,
    output wire         full, empty
);
  reg [W-1:0] mem [0:D-1];
  reg [1:0]   wptr, rptr;
  reg [2:0]   count;
  assign full  = (count == D);
  assign empty = (count == 0);
  always @(posedge clk) begin
    if (rst) begin
      wptr <= 0; rptr <= 0; count <= 0; dout <= 0;
    end else begin
      // BUG: a write is accepted even when the FIFO is full
      if (wr_en) begin
        mem[wptr] <= din;
        wptr <= wptr + 1'b1;
      end
      if (rd_en && !empty) begin
        dout <= mem[rptr];
        rptr <= rptr + 1'b1;
      end
      case ({wr_en, rd_en && !empty})
        2'b10: count <= (count == D) ? count : count + 1'b1;
        2'b01: count <= count - 1'b1;
        default: count <= count;
      endcase
    end
  end
endmodule
