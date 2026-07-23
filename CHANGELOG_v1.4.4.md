# Cannon Battle VN v1.4.4
## Chặn chọn văn bản trên điện thoại
- Áp dụng `user-select: none` và `-webkit-touch-callout: none` cho toàn bộ vùng trận đấu và các nút chức năng.
- Chặn sự kiện `selectstart`, `dragstart` và `contextmenu` trên các nút.
- Tự xóa vùng văn bản bị chọn nếu trình duyệt vẫn phát sinh lựa chọn trong lúc trận đấu đang hoạt động.
- Không chặn các ô nhập liệu trong màn hình thiết lập phòng.
## Sửa định nghĩa góc bắn siêu cao
- Góc siêu cao được tính từ góc nòng tại thời điểm khai hỏa của người bắn.
- 90° là hướng thẳng đứng lên từ vị trí người bắn.
- Mặc định ±15° tương ứng góc nòng 75°–89° do giới hạn nòng của game là 89°.
- Hướng quay trái hoặc phải không làm thay đổi điều kiện; game dùng độ nâng của nòng.
- Không sử dụng góc rơi hoặc hướng tiếp cận mục tiêu để xác định cơ chế này.
## Hướng dẫn
- Viết lại phần góc siêu cao và công thức sát thương bằng văn phong mô phạm, trung tính.
