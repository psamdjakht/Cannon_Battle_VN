# Cannon Battle VN v1.4.2
Game pháo theo lượt dành cho điện thoại và máy tính, gồm chế độ đấu với máy và phòng online 2–6 người.
## Điểm mới của v1.4.2
- Critical và góc siêu cao được phép cộng dồn theo phép nhân.
- Công thức: `damage cuối = damage cơ bản × hệ số Critical × hệ số góc siêu cao`.
- Ví dụ mặc định: `100 × 150% × 200% = 300 damage`.
- Góc siêu cao được xác định theo hướng viên đạn đang rơi tại điểm va chạm. 90° là rơi thẳng từ đỉnh đầu mục tiêu xuống.
- Biên độ mặc định là `90° ±15°`; có thể chỉnh từ ±1° đến ±45°.
- Khi góc va chạm nằm trong vùng siêu cao, game áp dụng toàn bộ hệ số góc siêu cao đã chọn; mặc định 200%.
- Toàn bộ tùy chọn Critical và góc siêu cao được chuyển vào nút **Điều chỉnh thông số kỹ thuật**.
- Có nút **Hướng dẫn chơi** ở menu, màn hình thiết lập và trong trận.
- Hướng dẫn giải thích đầy đủ điều khiển, địa hình, đạn dịch chuyển và công thức damage bằng cách xưng hô trung tính.
## Cấu hình mặc định cân bằng
- Critical: bật.
- Tỷ lệ Critical: 15%.
- Damage Critical: 150%.
- Góc siêu cao: bật.
- Biên độ góc siêu cao: 90° ±15°.
- Damage góc siêu cao: 200%.
- Nút **Khôi phục mặc định** trả toàn bộ thông số về các giá trị trên.
## Công thức sát thương
- Critical không xảy ra hoặc bị tắt: hệ số Critical = 1,00.
- Góc va chạm không nằm trong vùng siêu cao hoặc cơ chế bị tắt: hệ số góc = 1,00.
- Critical và góc siêu cao cùng xảy ra: hai hệ số được nhân với nhau.
- Ví dụ damage cơ bản 100: chỉ Critical = 150; chỉ siêu cao = 200; cả hai = 300.
## Các cơ chế đang có
- Đạn thường gây sát thương, khoét mặt đất và phá đảo bay.
- Đạn dịch chuyển không gây sát thương, không phá địa hình và đưa nhân vật tới điểm rơi hợp lệ.
- Mỗi người có 3 đạn dịch chuyển.
- 12 chủ đề bản đồ và bản đồ ngẫu nhiên.
- Chế độ đấu máy, đấu tự do và hai đội không sát thương đồng đội.
- Camera theo người có lượt, theo đạn và nút giữ để xem toàn cảnh.
## Điều khiển
### Điện thoại
- Vuốt ngang: di chuyển.
- Vuốt dọc: chỉnh góc nòng.
- NÒNG TRÁI/NÒNG PHẢI: quay nòng nhanh.
- Giữ/thả BẮN: lấy lực và khai hỏa.
- Giữ TOÀN CẢNH: zoom ra; hỗ trợ đa chạm cùng nút BẮN.
### Máy tính
- `← →`: di chuyển.
- `↑ ↓`: chỉnh góc.
- `Q / E`: quay nòng.
- Giữ/thả `Space`: lấy lực và bắn.
- Giữ `V`: xem toàn cảnh.
## Triển khai Render
Không cần `npm install`.
- Build Command: `node --check server.bundle.js && node --check public/js/game.js`
- Start Command: `node server.bundle.js`
- Environment: `NODE_VERSION=20.19.5`
Sau khi cập nhật GitHub, dùng `Manual Deploy → Clear build cache & deploy`.
## Kiểm tra đúng phiên bản
- Log Render: `Cannon Battle VN v1.4.2 đang chạy tại cổng ...`
- Console trình duyệt: `Cannon Battle VN client v1.4.2 loaded`
- JavaScript, CSS và Socket.IO dùng tham số `?v=1.4.2` để hạn chế cache cũ.
