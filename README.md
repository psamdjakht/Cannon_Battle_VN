# Cannon Battle VN v1.4.0
Game pháo theo lượt dành cho điện thoại và máy tính, gồm chế độ đấu với máy và phòng online 2–6 người.
## Điểm mới của v1.4.0
- Đạn thường phá được đảo bay giống như phá mặt đất; mỗi lần trúng tạo một lỗ vỡ thật trong phần va chạm và hình vẽ.
- Đạn dịch chuyển không phá đất hoặc đảo.
- Người đứng đúng phần đảo bị phá sẽ rơi xuống mặt đất; đảo bị phá gần hết sẽ biến mất hoàn toàn.
- Tăng từ 5 lên 12 chủ đề bản đồ: Đồi cỏ, Sa mạc, Núi tuyết, Núi lửa, Đảo bay, Rừng rậm, Hẻm núi, Mặt trăng, Thung lũng pha lê, Bão giông, Quần đảo trên không và Đất đỏ hiểm trở.
- Bản đồ ngẫu nhiên chọn trong toàn bộ 12 chủ đề.
- Mỗi cú đạn thường có 30% xác suất CRITICAL, gây 150% sát thương.
- Đạn CRITICAL có ánh lửa, quầng sáng và tia lóe riêng khi đang bay; khi trúng hiện chữ `CRITICAL 150%`.
- Sát thương vòng cầu được tính theo góc viên đạn đang rơi tại điểm va chạm, không chỉ dựa trên góc nâng nòng lúc bắn.
- Góc rơi đến 50° vẫn tính sát thương bình thường; từ trên 50° tăng dần và đạt tối đa 200% khi rơi gần thẳng đứng 90°.
- CRITICAL và vòng cầu có thể cộng dồn: tối đa 300% sát thương cơ bản nếu vừa CRITICAL vừa đạt góc rơi tối đa.
- Công thức sát thương và phá đảo được tính đồng nhất trong đấu máy và trên máy chủ online.
## Công thức sát thương
- Sát thương cơ bản: giá trị chủ phòng chọn.
- Hệ số vòng cầu: `1,00` ở góc rơi ≤ 50°, tăng tuyến tính tới `2,00` ở 90°.
- Hệ số CRITICAL: `1,50` với xác suất 30%.
- Sát thương cuối: `làm tròn(sát thương cơ bản × hệ số vòng cầu × hệ số CRITICAL)`.
## Điều khiển
### Điện thoại
- Vuốt ngang trên bản đồ: di chuyển nhân vật và pháo.
- Vuốt dọc: chỉnh góc nòng.
- NÒNG TRÁI/NÒNG PHẢI: đổi nhanh hướng nòng.
- Giữ BẮN: tăng lực; thả tay: khai hỏa.
- Giữ TOÀN CẢNH: zoom ra; có thể giữ bằng một ngón trong khi ngón khác giữ BẮN.
### Máy tính
- `← →`: di chuyển.
- `↑ ↓`: chỉnh góc.
- `Q / E`: quay nòng trái/phải.
- Giữ/thả `Space`: lấy lực và bắn.
- Giữ `V`: xem toàn cảnh.
## Triển khai Render
Không cần `npm install`.
- Build Command: `node --check server.bundle.js && node --check public/js/game.js`
- Start Command: `node server.bundle.js`
- Environment: `NODE_VERSION=20.19.5`
Sau khi cập nhật GitHub, dùng `Manual Deploy → Clear build cache & deploy`.
## Kiểm tra đúng phiên bản
- Log Render: `Cannon Battle VN v1.4.0 đang chạy tại cổng ...`
- Console trình duyệt: `Cannon Battle VN client v1.4.0 loaded`
- JavaScript, CSS và Socket.IO dùng tham số `?v=1.4.0` để tránh iPhone giữ cache cũ.
## Cấu trúc chính
- `server.bundle.js`: máy chủ độc lập đã đóng gói Express và Socket.IO, không cần `node_modules`.
- `server.js`: mã nguồn máy chủ dễ đọc.
- `public/js/game.js`: logic đấu máy, vật lý, camera, đảo phá hủy và hiệu ứng.
- `public/style.css`: giao diện responsive dọc/ngang.
- `public/assets/animals`: bộ nhân vật.
