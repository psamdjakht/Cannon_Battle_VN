# Deploy Cannon Battle VN v1.4.4 lên Render
1. Giải nén ZIP và upload toàn bộ nội dung bên trong thư mục `Cannon_Battle_VN` lên thư mục gốc repository GitHub.
2. Trong Render Settings đặt:
   - Build Command: `node --check server.bundle.js && node --check public/js/game.js`
   - Start Command: `node server.bundle.js`
   - Environment Variable: `NODE_VERSION=20.19.5`
3. Chọn `Manual Deploy → Clear build cache & deploy`.
4. Log đúng phiên bản phải có: `Cannon Battle VN v1.4.4 đang chạy tại cổng ...`.
5. Mở Console trình duyệt phải thấy: `Cannon Battle VN client v1.4.4 loaded`.
6. Đóng hoàn toàn tab cũ trước khi thử; trên iPhone có thể mở tab riêng tư trong lần đầu để loại trừ cache.
Không dùng `npm install`; `server.bundle.js` đã chứa sẵn thư viện máy chủ.

## Xác nhận đã deploy đúng v1.4.5

1. Sau khi tải mã lên GitHub, phải xuất hiện một commit mới. Mã commit trên Render không được tiếp tục là commit cũ.
2. Mở `https://<ten-dich-vu>.onrender.com/version`.
3. Kết quả đúng:

```json
{"app":"Cannon Battle VN","version":"1.4.5"}
```

4. Trong menu game phải thấy nhãn `v1.4.5` cạnh tên game.
5. Trong Hướng dẫn chơi phải thấy dòng `Hướng dẫn luật chơi • Phiên bản 1.4.5`.

`Clear build cache & deploy` chỉ xóa dữ liệu build cũ rồi triển khai commit mới nhất đang có trên nhánh liên kết. Nếu Render vẫn hiển thị cùng mã commit cũ, cần commit/push lại mã v1.4.5 lên nhánh `main` trước khi deploy.
