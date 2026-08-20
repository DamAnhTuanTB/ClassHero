# Final Screen UI

Thư mục này lưu visual reference bền vững cho UI của dự án.

## Cấu trúc

```txt
docs/final-screen-ui/
├── laptop/<role>/<route>/   UI đã chốt ở viewport laptop
├── ipad/<role>/<route>/     UI đã chốt ở viewport iPad
├── mobile/<role>/<route>/   UI đã chốt ở viewport mobile
└── _designs/                Thiết kế hoàn chỉnh đang chờ owner duyệt
```

Role dùng một trong `public`, `student`, `admin`, `parent`. Route `/` dùng
folder `home`; route động dùng slug/id thật khi screenshot dựa trên dữ liệu thật.

Viewport mặc định:

- Laptop: `1440x1000`.
- iPad: `834x1112`.
- Mobile: `390x844`.

Ảnh dưới `_designs/` là mục tiêu thiết kế, chưa tự động trở thành UI được duyệt.
Chỉ chuyển/lưu vào nhóm viewport chính sau khi owner xác nhận `ưng/ok/chốt` và
runtime phù hợp đã được chụp. Artifact debug tạm thời vẫn đặt ở
`.codex/screenshots/`, không đưa vào đây.

`manifest.json` là index tùy chọn; nếu chưa có, duyệt trực tiếp theo
viewport/role/route.
