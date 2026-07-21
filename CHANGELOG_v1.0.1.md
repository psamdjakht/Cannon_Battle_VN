# Thay đổi v1.0.1

- Loại bỏ bước tải Express và Socket.IO khi deploy.
- Bundle toàn bộ máy chủ vào `server.bundle.js`.
- Đưa Socket.IO client vào `public/vendor/socket.io.min.js`.
- Sửa `render.yaml`: Build Command chỉ kiểm tra cú pháp, Start Command chạy bundle.
- Thêm `.node-version` để ưu tiên Node.js 20.19.5.
- Xóa `package-lock.json` có đường dẫn registry nội bộ.
- Sửa file chạy Windows để không gọi `npm install`.
- Giữ nguyên cơ chế game, nhân vật, đấu máy và phòng online.
