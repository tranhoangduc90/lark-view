# Luyện tập bổ trợ

Frontend tĩnh để học viên xem lại một Lark Base view bằng giao diện HTML riêng.

## Link public

Sau khi GitHub Pages build xong, trang chạy tại:

```text
https://tranhoangduc90.github.io/lark-view/
```

Ví dụ URL có sẵn query:

```text
https://tranhoangduc90.github.io/lark-view/?base_id=HxvnbovVlagwPusroJylznDEgjg&table_id=tblG3rbdqAz51QgT&view_id=vewROCbUVy
```

## Kiến trúc

- GitHub Pages chỉ host frontend: `index.html`, `app.js`, `styles.css`.
- Frontend gọi API proxy hiện có ở `https://ducizone.ddns.net/lark-view/api/view`.
- Token Lark, Redis, app secret, và allowlist Base vẫn phải nằm ở VPS/backend, không đưa vào repo này.

## Lưu ý bảo mật

- Không thêm Lark token, Redis URL, GitHub token, app secret, hoặc dữ liệu học viên thô vào repo.
- Backend VPS nên chỉ cho phép các `base_id` cần dùng qua `LARK_ALLOWED_APPS`.
- Backend cần bật CORS cho origin `https://tranhoangduc90.github.io`.
- Không để endpoint nào trả token ra trình duyệt.
