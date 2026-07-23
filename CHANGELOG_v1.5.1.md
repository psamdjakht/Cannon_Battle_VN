# Cannon Battle VN v1.5.1

## Địa hình
- Loại bỏ toàn bộ mã và dữ liệu liên quan đến đảo bay.
- Xóa các bản đồ đảo bay khỏi danh sách chọn và bản đồ ngẫu nhiên.
- Đạn thường chỉ khoét mặt đất; đạn dịch chuyển chỉ đáp xuống mặt đất hợp lệ.
- Xóa trường `surfaceId` và toàn bộ nhánh xử lý bề mặt phụ.

## Điều khiển góc bắn
- Khóa trục vuốt sau khi ngón tay đi đủ 14 px.
- Làm mượt vị trí ngón tay trước khi đổi góc.
- Góc thay đổi theo từng nấc 1° để dễ căn chỉnh.
- Bỏ qua rung cảm ứng dưới 3 px.
- Khi đổi chiều vuốt, áp dụng vùng trễ 8 px để nòng không giật lên xuống.
- Gửi góc lên máy chủ tối đa mỗi 80 ms và xác nhận góc cuối khi thả tay.

## Chọn phe
- Mỗi người chơi phải chọn Phe Xanh hoặc Phe Đỏ trước khi tạo/vào phòng hai phe.
- Mỗi phe có số chỗ bằng nhau; phe đầy sẽ bị khóa.
- Máy chủ giữ nguyên lựa chọn của người chơi, không tự đổi phe.
- Chỉ bắt đầu khi hai phe có số người bằng nhau và mỗi phe có ít nhất một người.
- Thứ tự lượt được sắp xen kẽ Xanh – Đỏ.
- Màu phe được hiển thị rõ trên vòng chân, phòng chờ, thanh người chơi và banner lượt.
