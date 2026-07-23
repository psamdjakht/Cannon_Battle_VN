# Cannon Battle VN v1.2.0
Game pháo theo lượt chạy trên trình duyệt, gồm đấu với máy và phòng online. Bản này sửa lỗi cả phòng bị khóa sau đạn dịch chuyển, thêm xoay nòng nhanh, chia hai đội và tăng độ nhạy vuốt dọc.
## Điểm mới
- Đạn dịch chuyển kết thúc lượt bằng ba lớp bảo vệ: timer cũ, tín hiệu hoàn tất hoạt ảnh và watchdog máy chủ.
- Khi máy chủ đã chuyển lượt nhưng thiết bị còn giữ hoạt ảnh cũ, trình duyệt tự hủy hoạt ảnh để trả điều khiển.
- Điện thoại có nút `↶ NÒNG TRÁI` và `NÒNG PHẢI ↷`.
- Máy tính dùng `Q` quay trái, `E` quay phải.
- Vuốt dọc chỉnh góc nhanh hơn và cập nhật góc ngay trên thiết bị trước khi đồng bộ.
- Phòng online có thể chọn Đội Xanh và Đội Đỏ.
- Lượt chơi xen kẽ giữa hai đội; người cùng đội không bị sát thương bởi đạn nổ của đồng đội.
- Chế độ hai đội chỉ bắt đầu khi số người hiện tại là số chẵn.
## Điều khiển
### Điện thoại
- Vuốt ngang: di chuyển nhân vật và pháo.
- Vuốt dọc: nâng/hạ góc nòng.
- Hai nút nòng: đổi hướng bắn trái/phải ngay lập tức.
- Giữ nút BẮN: tăng lực; thả tay để bắn.
- Bật Đạn dịch chuyển: cú bắn kế tiếp dịch chuyển tới vị trí đáp an toàn.
### Máy tính
- `←` / `→`: di chuyển.
- `↑` / `↓`: chỉnh góc.
- `Q` / `E`: quay nòng trái/phải.
- Giữ `Space`: tăng lực; thả `Space` để bắn.
## Chạy trên Windows
Cần Node.js 20 trở lên. Chạy `CHAY_LOCAL_WINDOWS.bat`, hoặc:
```text
node server.bundle.js
```
Mở `http://localhost:10000`.
## Deploy Render
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
Không dùng `npm install`. `server.bundle.js` đã chứa sẵn phần máy chủ và các thư viện cần thiết.
## Lưu ý
- Phòng lưu trong RAM; deploy hoặc khởi động lại Render sẽ xóa phòng đang mở.
- Bản `server.js` là mã nguồn dễ đọc đã cập nhật cùng logic v1.2.0.
- `server.bundle.js` là file chạy trực tiếp trên Render.
