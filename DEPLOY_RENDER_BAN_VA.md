# Deploy Cannon Battle VN v1.3.1 lên Render
1. Upload toàn bộ nội dung thư mục `Cannon_Battle_VN` lên thư mục gốc GitHub.
2. Render Settings:
   - Build Command: `node --check server.bundle.js && node --check public/js/game.js`
   - Start Command: `node server.bundle.js`
   - Environment Variable: `NODE_VERSION=20.19.5`
3. Chọn `Manual Deploy → Clear build cache & deploy`.
4. Log máy chủ vẫn hiện `Cannon Battle VN v1.3.0 wide-map teleport patch loaded` vì phần server không đổi. Mở Console trình duyệt phải thấy `Cannon Battle VN client v1.3.1 loaded`.
5. Đóng hoàn toàn tab game cũ rồi mở lại. Trên iPhone có thể dùng tab riêng tư trong lần kiểm tra đầu để loại trừ cache.
Không dùng `npm install`; bản server đã được đóng gói độc lập.
