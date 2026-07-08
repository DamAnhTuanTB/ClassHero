# Playwright UI Checks

## Chủ đề này dùng để làm gì?

Playwright giúp kiểm tra UI bằng browser thật thay vì chỉ dựa vào TypeScript/build. Trong repo này, Playwright còn dùng để chụp screenshot local cho owner review màn hình nhanh hơn.

## Cách nó hoạt động trong repo

Playwright được đặt trong `apps/web`:

- `apps/web/playwright.config.ts`: cấu hình browser, viewport, web server và nơi lưu report.
- `apps/web/tests/auth-ui.spec.ts`: test/screenshot cho auth UI `M2.4`.
- `.codex/screenshots/`: nơi lưu ảnh screenshot local.
- `.codex/playwright-results/` và `.codex/playwright-report/`: nơi lưu trace/report local khi test chạy.

Các artifact trong `.codex/screenshots`, `.codex/playwright-results` và `.codex/playwright-report` bị ignore để không commit nhầm ảnh/report local.

## Luồng kỹ thuật

1. Chạy script:

```bash
pnpm --filter @learning-path/web e2e:auth-ui
```

2. Playwright build web app rồi chạy `next start` ở `http://127.0.0.1:3000`.
3. Test mở các route auth, kiểm tra heading, kiểm tra `robots=noindex,nofollow`.
4. Test chụp screenshot cho desktop, tablet và mobile.
5. Test submit form login để kiểm tra validation, loading và success mock state.

## Kỹ thuật chính

- Dùng Chromium để tránh phải tải nhiều browser khi chỉ cần review UI.
- Tablet dùng viewport Chromium thủ công thay vì preset iPad/WebKit.
- Screenshot chạy trên production server (`next build` + `next start`) để không bị dính badge/dev overlay.
- Test dùng role/label locator để gần với cách người dùng thật tương tác.

## File quan trọng

- `apps/web/playwright.config.ts`
- `apps/web/tests/auth-ui.spec.ts`
- `.codex/screenshots/`
- `apps/web/package.json`

## Khi nào cần nhớ lại?

- Khi cần chụp ảnh màn hình cho owner review UI.
- Khi muốn kiểm tra responsive nhanh trên desktop/tablet/mobile.
- Khi trước khi commit UI cần bằng chứng route render được và form cơ bản hoạt động.

## Task liên quan

- `M2.4`: Auth UI mock.
- `M14.3`: Playwright E2E cho flow chính.
