# Deploy Cannon Battle VN v1.2.0 lên Render
## 1. Cập nhật GitHub
Ghi đè toàn bộ file cũ bằng bản v1.2.0. Các file `server.bundle.js`, `package.json`, `render.yaml`, `.node-version` và thư mục `public` phải nằm ngay thư mục gốc.
## 2. Cấu hình Render
Build Command:
```text
node --check server.bundle.js && node --check public/js/game.js
```
Start Command:
```text
node server.bundle.js
```
Environment Variable:
```text
NODE_VERSION=20.19.5
```
## 3. Deploy sạch
Chọn `Manual Deploy` → `Clear build cache & deploy`.
Nếu log còn hiện `npm install`, vào Settings sửa Build Command thủ công vì Render đang giữ cấu hình cũ.
## 4. Kiểm tra
Mở `/health`. Kết quả hợp lệ:
```json
{"ok":true,"rooms":0}
```
Trong log khởi động phải có:
```text
Cannon Battle VN v1.2.0 runtime patch loaded
```
