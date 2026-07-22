# Thay đổi v1.1.0

## Chiến đấu
- Kéo dài nòng pháo và vẽ đầu nòng/đường chỉ hướng nổi trên lớp nhân vật.
- Mở góc bắn từ 2° đến 89° và tăng tốc độ chỉnh góc bằng phím/vuốt.
- Thêm hiệu ứng nổ lửa, sóng xung kích, hạt lửa và vòng bán kính nổ rõ.
- Mỗi người có 3 đạn dịch chuyển; cú bắn dịch chuyển không gây sát thương.
- Máy có thể chủ động dùng đạn dịch chuyển để lên đảo hoặc đổi vị trí chiến thuật.

## Phòng online
- Hiển thị danh sách phòng đang mở ngay tại menu.
- Nhấp phòng để tham gia nhanh; mã phòng thủ công được giữ làm phương án dự phòng.
- Chủ phòng có nút chơi lại cùng phòng sau khi kết thúc; người còn kết nối được đưa vào ván mới.
- Máy chủ tiếp tục xác thực lượt, vị trí, quỹ đạo, sát thương và dịch chuyển.

## Bản đồ và giao diện
- Thêm bản đồ đảo bay chiến thuật.
- Thêm lựa chọn bản đồ ngẫu nhiên; mỗi ván tạo địa hình mới và bố trí người hợp lệ.
- Khóa màn hình game toàn màn hình, ngăn thanh cuộn làm trượt bản đồ.
- Đưa gió, thời gian, góc, lực và tip điều khiển vào trong bản đồ.
- Thu gọn HUD để ưu tiên diện tích bản đồ.

## Triển khai
- Giữ cơ chế standalone không cần `npm install` trên Render.
- Dùng Node.js 20.19.5, chạy `server.bundle.js`.
