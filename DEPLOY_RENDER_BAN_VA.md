# Cannon Battle VN v1.0.1 - Bản vá Render không cần npm install

## Nguyên nhân lỗi bản cũ
Bản cũ có `package-lock.json` chứa đường dẫn registry nội bộ của môi trường đóng gói và dùng Node.js 22.17.0. Khi Render chạy `npm install`, npm có thể lỗi `Exit handler never called!` trước khi cài xong dependency.

## Cách bản vá hoạt động
- Express và Socket.IO phía máy chủ đã được đóng gói sẵn trong `server.bundle.js`.
- Socket.IO phía trình duyệt đã được đặt tại `public/vendor/socket.io.min.js`.
- Render không cần tải package từ npm.
- Node.js được cố định ở 20.19.5.

## Cách cập nhật GitHub
Xóa toàn bộ file cũ trong repository rồi upload toàn bộ nội dung của thư mục bản vá này. Đặc biệt phải có:
- `server.bundle.js`
- `.node-version`
- `render.yaml`
- `public/vendor/socket.io.min.js`

## Cấu hình Render
Nếu dịch vụ được tạo bằng Blueprint, Render sẽ đọc `render.yaml`.

Nếu dịch vụ được tạo thủ công, vào Settings và đặt:
- Build Command: `node --check server.bundle.js && node --check public/js/game.js`
- Start Command: `node server.bundle.js`
- Environment Variable `NODE_VERSION`: `20.19.5`

Sau đó chọn Manual Deploy > Clear build cache & deploy.

## Trường hợp Render vẫn giữ Build Command cũ là npm install
Bản vá không còn dependency trong `package.json`, nên `npm install` cũng không phải tải Express hoặc Socket.IO. Tuy nhiên vẫn nên đổi Build Command như trên để loại bỏ hoàn toàn npm khỏi quá trình deploy.
