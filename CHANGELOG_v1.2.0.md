# Thay đổi v1.2.0
## Sửa lỗi khóa phòng sau đạn dịch chuyển
- Mỗi cú bắn được lưu mã định danh và thời điểm mở khóa dự phòng.
- Trình duyệt báo cho máy chủ khi hoạt ảnh đã hoàn tất.
- Watchdog kiểm tra định kỳ và tự chuyển lượt nếu timer hoặc thiết bị gặp lỗi.
- Trình duyệt hủy hoạt ảnh cũ khi nhận được lượt mới.
- Chặn timer cũ chuyển lượt lần thứ hai sau khi lớp dự phòng đã xử lý.
## Xoay nòng
- Thêm hướng nòng độc lập với góc nâng.
- Điện thoại có hai nút quay trái/phải.
- Máy tính dùng Q/E.
- Di chuyển vẫn tự xoay nòng theo hướng đi.
## Chia đội
- Đội Xanh/Đội Đỏ được phân xen kẽ A-B-A-B.
- Hai đội xuất phát ở hai phía của bản đồ.
- Lượt chơi cũng xen kẽ giữa hai đội.
- Đạn nổ không gây sát thương đồng đội; tự gây sát thương cho chính mình vẫn được giữ.
- Kết quả thắng/thua được xác định theo đội.
## Điều khiển cảm ứng
- Tăng hệ số vuốt dọc từ 0,48 lên 1,25.
- Giảm ngưỡng nhận thao tác từ 0,35 xuống 0,12.
- Góc ngắm cập nhật lạc quan tại thiết bị để nhiều sự kiện vuốt không cộng từ dữ liệu cũ.
