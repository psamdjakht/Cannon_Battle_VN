# Cannon Battle VN v1.4.5

- Thêm `/version` và trường `version` trong `/health` để xác nhận bản đang chạy.
- Tắt cache đối với HTML, JavaScript và CSS; ảnh nhân vật vẫn được phép cache.
- Thêm nhãn phiên bản hiển thị trong menu và cửa sổ Hướng dẫn chơi.
- Chặn `contextmenu`, `selectstart`, `dragstart` ở capture phase trên nút chức năng.
- Chặn `touchstart` và `touchmove` của hai nút giữ lâu BẮN và TOÀN CẢNH để Safari không mở Copy/Dịch/Tra cứu.
- Viết lại hướng dẫn góc bắn siêu cao: tính theo góc nòng của người bắn lúc khai hỏa; không tính theo góc rơi hoặc góc va chạm ở mục tiêu.
