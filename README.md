# Cannon Battle VN v1.3.1
Game pháo theo lượt dành cho điện thoại và máy tính, gồm đấu với máy và phòng online.
## Điểm mới của v1.3.1
- Sửa lỗi Safari/iPhone bị đứng sau khi AI hoặc người chơi bắn đạn dịch chuyển: hiệu ứng cổng từng vẽ vòng tròn có bán kính âm và làm Canvas ném `IndexSizeError`.
- Thêm watchdog riêng cho lượt AI; lỗi tính góc, callback bị mất hoặc bắn thất bại đều không còn khóa trận.
- Sửa lỗi đứng toàn bộ hoạt động sau đạn dịch chuyển trong chế độ 1 người đấu máy.
- Nhân vật được chuyển tới đúng bề mặt nơi đạn rơi; lượt chơi tự tiếp tục kể cả khi hoạt ảnh Canvas gặp lỗi.
- Bản đồ rộng gấp đôi: 1.920 × 540 đơn vị logic.
- Camera bám người có lượt và bám theo viên đạn khi bắn.
- Giữ nút `🔭 TOÀN CẢNH` để zoom mượt ra toàn bản đồ; có thể đồng thời giữ nút BẮN bằng ngón khác.
- Lực tối đa 1.050, đủ bắn qua bản đồ khi chọn góc phù hợp.
- Bố cục dọc và ngang không để cụm nút che vùng chơi; nút dùng nền trong suốt.
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
Log Render phải có dòng:
`Cannon Battle VN v1.3.0 wide-map teleport patch loaded`
- Console trình duyệt: `Cannon Battle VN client v1.3.1 loaded`
Trình duyệt tải `game.js`, CSS và Socket.IO với tham số `?v=1.3.1` để hạn chế cache bản cũ.
## Cấu trúc chính
- `server.bundle.js`: máy chủ độc lập, không cần node_modules.
- `server.js`: mã nguồn máy chủ dễ đọc.
- `public/js/game.js`: logic game, camera và điều khiển.
- `public/style.css`: giao diện responsive dọc/ngang.
- `public/assets/characters`: bộ nhân vật.
