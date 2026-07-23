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
