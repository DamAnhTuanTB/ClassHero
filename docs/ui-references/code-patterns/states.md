# State View Code Patterns

Dùng file này cho loading, empty, error và disabled/pending state.

## 1. Loading, Empty, Error State

Dùng cho màn có data/action.

### Pattern chuẩn

- Loading: skeleton hoặc state component rõ, không để vùng trống.
- Empty: nói người dùng có thể làm gì tiếp theo.
- Error: có action retry khi có thể.
- Disabled/pending: action đang chạy phải disabled và có feedback.

### Không làm

- Không để button nhìn bấm được nhưng thiếu handler hoặc pending state.
- Không hiển thị text kỹ thuật như `mock`, task code, stack trace hoặc TODO trong UI.
