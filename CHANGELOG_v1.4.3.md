# Cannon Battle VN v1.4.3

## Sửa lỗi nút chức năng làm lệch góc nòng
- Tách pointer bắt đầu trên các nút chức năng khỏi pointer dùng để vuốt bản đồ.
- Giữ nút TOÀN CẢNH không còn tạo thay đổi góc nòng.
- Các nút BẮN, ĐẠN DỊCH CHUYỂN, NÒNG TRÁI, NÒNG PHẢI, BỎ LƯỢT, HƯỚNG DẪN và THOÁT cũng được cô lập tương tự.
- Vẫn hỗ trợ đa chạm: một ngón giữ TOÀN CẢNH hoặc BẮN, ngón còn lại có thể vuốt trực tiếp trên bản đồ để chỉnh góc/di chuyển.
- Xóa gesture cũ khi Safari tái sử dụng pointerId sau pointercancel/lostpointercapture.
