# Deploy Cannon Battle VN v1.5.1 lên Render

1. Giải nén ZIP và đưa toàn bộ nội dung bên trong thư mục `Cannon_Battle_VN` lên thư mục gốc của repository GitHub.
2. Commit và push lên nhánh `main`. Render phải nhìn thấy mã commit mới.
3. Trong Render Settings đặt:
   - Build Command: `node --check server.bundle.js && node --check public/js/game.js`
   - Start Command: `node server.bundle.js`
   - Environment Variable: `NODE_VERSION=20.19.5`
4. Chọn `Manual Deploy → Clear build cache & deploy`.
5. Log đúng phải có: `Cannon Battle VN v1.5.1 đang chạy tại cổng ...`.
6. Mở `/version`; kết quả đúng:

```json
{"app":"Cannon Battle VN","version":"1.5.1"}
```

7. Menu phải hiển thị `v1.5.1`; Console trình duyệt phải có `Cannon Battle VN client v1.5.1 loaded`.

Không dùng `npm install`; `server.bundle.js` đã chứa thư viện máy chủ.

`Clear build cache & deploy` chỉ triển khai commit mới nhất trên GitHub. Nếu Render vẫn hiển thị mã commit cũ thì mã mới chưa được commit/push lên nhánh `main`.
