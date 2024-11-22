# Slot Game RTP & Probability Calculations

## Tổng quan

- Board size: 3x5
- Số symbols: 10 (2 special, 2 high, 2 medium, 4 low)
- Target RTP: <97%

## Symbol Weights & Configurations

### Reel Weights Distribution

Tổng weight mỗi reel:
R1 = 32 (1+1+2+2+3+3+5+5+5+5)
R2 = 38 (1+1+2+2+4+4+6+6+6+6)
R3 = 41 (2+1+3+3+4+4+6+6+6+6)
R4 = 38
R5 = 38

### Symbol Configurations

javascript
{
// Special Symbols
WILD: {
weights: [1,1,2,1,1],
payouts: [0,0,25,88,188],
features: ['expanding', 'substitute']
},
SCATTER: {
weights: [1,1,1,1,1],
payouts: [0,0,3,10,50]
},
// High Paying
HIGH_A: {
weights: [2,2,3,2,2],
payouts: [0,0,15,50,150]
},
HIGH_B: {
weights: [2,2,3,2,2],
payouts: [0,0,12,40,125]
},
// Medium Paying
MID_A: {
weights: [3,4,4,4,4],
payouts: [0,0,10,30,75]
},
MID_B: {
weights: [3,4,4,4,4],
payouts: [0,0,8,25,60]
},
// Low Paying
LOW_A: {
weights: [5,6,6,6,6],
payouts: [0,0,5,15,45]
},
LOW_B: {
weights: [5,6,6,6,6],
payouts: [0,0,4,12,35]
},
LOW_C: {
weights: [5,6,6,6,6],
payouts: [0,0,3,10,30]
},
LOW_D: {
weights: [5,6,6,6,6],
payouts: [0,0,2,8,25]
}
}

## Detailed RTP Calculations

### 1. HIGH_A (Symbol cao nhất)

3 symbols: 3.875% RTP
Base combination: 2.25%
With WILD: 1.625%
4 symbols: 0.800% RTP
Base combination: 0.4%
With WILD: 0.4%
5 symbols: 0.120% RTP
Base combination: 0.06%
With WILD: 0.06%
Total RTP: 4.795%

### 2. LOW_D (Symbol thấp nhất)

Xác suất trúng:
3 symbols: ~2.24% (1/44.6)
4 symbols: ~0.316% (1/316.5)
5 symbols: ~0.05% (1/2000)
RTP Breakdown:
3 symbols: 4.478%
4 symbols: 2.526%
5 symbols: 1.248%
Total RTP: 8.252%

### 3. WILD Impact Analysis

#### Direct WILD Combinations

Per Reel Probability:
R1: 3.125%
R2: 2.63%
R3: 4.88%
R4: 2.63%
R5: 2.63%
Overall Board Probability:
Ít nhất 1 WILD: 14.7%
1 WILD: ~10%
2 WILD: ~4%
3+ WILD: ~0.7%

## Expanding WILD Feature Impact

### Mechanics

1. WILD xuất hiện sẽ mở rộng full reel
2. Tăng winning chance lên 3x cho reel đó
3. Áp dụng cho tất cả symbols trên reel

### RTP Impact

- Tăng direct WILD RTP lên 3x
- Tăng tổng game RTP thêm 8-10%

## Recommendations for Balancing

### 1. WILD Adjustments

- Giảm weight R3 từ 2 xuống 1
- Hoặc giảm WILD payouts
- Thêm điều kiện cho expanding feature

### 2. Symbol Distribution

- Duy trì weight ratio hiện tại
- Có thể tăng nhẹ weight của low symbols

### 3. Payout Adjustments

- Giữ high symbol payouts để duy trì volatility
- Có thể giảm nhẹ medium symbol payouts

## Monitoring & Adjustments

1. Track thực tế RTP sau 1M spins
2. Monitor tần suất WILD expansions
3. Theo dõi big win frequency
4. Điều chỉnh weights nếu cần
