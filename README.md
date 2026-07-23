# Cannon Battle VN v1.4.5
Game pháo theo lượt dành cho điện thoại và máy tính, gồm chế độ đấu với máy và phòng online 2–6 người.
## Điểm mới của v1.4.5
- Chặn chọn văn bản, kéo nội dung, menu sao chép và menu tra cứu khi nhấn giữ các nút chức năng trên điện thoại.
- Áp dụng cho BẮN, TOÀN CẢNH, ĐẠN DỊCH CHUYỂN, NÒNG TRÁI, NÒNG PHẢI, BỎ LƯỢT và các nút trong trận.
- Giữ nguyên cơ chế đa chạm: một ngón có thể giữ TOÀN CẢNH hoặc BẮN, ngón còn lại điều khiển trực tiếp trên bản đồ.
- Góc siêu cao được xác định theo góc nòng tại thời điểm người bắn khai hỏa, không còn tính theo hướng viên đạn rơi tại mục tiêu.
- Mốc 90° là hướng thẳng đứng lên từ vị trí người bắn.
- Với biên độ mặc định ±15°, góc nòng từ 75° đến 89° được tính là góc bắn siêu cao ở cả hướng trái và hướng phải.
- Phần Hướng dẫn chơi đã được viết lại theo văn phong mô phạm, trung tính và giải thích rõ công thức sát thương.
## Cấu hình mặc định cân bằng
- Critical: bật.
- Tỷ lệ Critical: 15%.
- Damage Critical: 150%.
- Góc phóng siêu cao: bật.
- Biên độ: 90° ±15°.
- Damage góc siêu cao: 200%.
- Nút **Khôi phục mặc định** trả toàn bộ thông số về các giá trị trên.
## Công thức sát thương
- Critical không xảy ra hoặc bị tắt: hệ số Critical = 1,00.
- Góc nòng khi khai hỏa nằm ngoài vùng siêu cao hoặc cơ chế bị tắt: hệ số góc = 1,00.
- Critical và góc siêu cao cùng xảy ra: hai hệ số được nhân với nhau.
- Công thức: `damage cuối = damage cơ bản × hệ số Critical × hệ số góc siêu cao`.
- Ví dụ damage cơ bản 100: chỉ Critical = 150; chỉ góc siêu cao = 200; cả hai = 300.
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
- Log Render: `Cannon Battle VN v1.4.5 đang chạy tại cổng ...`
- Console trình duyệt: `Cannon Battle VN client v1.4.5 loaded`
- JavaScript, CSS và Socket.IO dùng tham số `?v=1.4.4` để hạn chế cache cũ.
