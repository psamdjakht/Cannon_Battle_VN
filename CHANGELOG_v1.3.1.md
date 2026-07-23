# Cannon Battle VN v1.3.1
## Sửa lỗi nghiêm trọng
- Sửa lỗi Canvas `IndexSizeError` trong hiệu ứng đạn dịch chuyển.
- Nguyên nhân: vòng cổng dịch chuyển thứ ba có thể được vẽ với bán kính âm ở frame đầu (`18 - 30 = -12`). Safari/iPhone dừng khung hình tại `ctx.arc(...)`, khiến lượt AI hoặc lượt người chơi bị khóa sau khi đạn dịch chuyển chạm đất.
- Mỗi vòng hiệu ứng hiện chỉ được vẽ khi bán kính lớn hơn 0,5 px; độ dày nét cũng được giới hạn an toàn.
## Chống kẹt lượt AI
- Thêm watchdog riêng cho giai đoạn AI suy nghĩ và chuẩn bị bắn.
- Nếu callback AI bị hủy, quá hạn hoặc phép tính ngắm bắn phát sinh lỗi, AI tự dùng phương án dự phòng hoặc bỏ lượt thay vì khóa trận.
- Nếu AI không thể gọi hàm bắn, game tự chuyển lượt.
- Bọc mô phỏng cú bắn bằng `try/catch`; hoàn lại đạn dịch chuyển nếu mô phỏng thất bại.
## Chống cache
- `game.js`, CSS và Socket.IO dùng tham số `?v=1.3.1`.
- Console trình duyệt hiển thị `Cannon Battle VN client v1.3.1 loaded`.
## Kiểm tra
- Kiểm thử trình duyệt Chromium ở kích thước điện thoại 430×932.
- Ép AI luôn chọn đạn dịch chuyển trên bản đồ đảo bay.
- AI dịch chuyển tới điểm rơi, giảm đạn từ 3 xuống 2, kết thúc hiệu ứng và trả lượt cho người chơi.
- Không còn `IndexSizeError`, không còn projectile/explosion treo và `shotInProgress` trở về `false`.
