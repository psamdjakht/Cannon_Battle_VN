# Cannon Battle VN v1.4.2

## Thay đổi chính
- Critical và góc siêu cao được cộng dồn theo phép nhân.
- Công thức: `damage cuối = damage cơ bản × Critical × góc siêu cao`.
- Ví dụ mặc định: `100 × 150% × 200% = 300 damage`.
- Góc siêu cao không còn tăng dần từ 50°. Đạn chỉ nhận bonus khi hướng rơi nằm trong vùng `90° ± biên độ`.
- Biên độ mặc định là ±15°, có thể chỉnh từ ±1° đến ±45°.
- Tách toàn bộ cấu hình nâng cao vào nút **Điều chỉnh thông số kỹ thuật**.
- Có thể bật/tắt Critical, chỉnh tỷ lệ Critical, hệ số Critical, bật/tắt góc siêu cao, chỉnh biên độ và hệ số góc siêu cao.
- Nút **Khôi phục mặc định** trả về: Critical 15% × 150%; góc siêu cao 90° ±15° × 200%.
- Thêm nút **Hướng dẫn chơi** ở menu, màn hình thiết lập và trong trận.
- Hướng dẫn giải thích đầy đủ điều khiển, đạn dịch chuyển, địa hình, Critical, góc siêu cao và công thức damage bằng cách xưng hô trung tính.
- Máy chủ online quyết định Critical, góc va chạm và damage để mọi thiết bị nhận cùng kết quả.
