# Cannon Battle VN v1.4.0
## Đảo bay phá hủy
- Đạn thường tạo lỗ vỡ trên đảo bay và mở đường bắn xuyên qua đảo.
- Va chạm đạn bỏ qua các phần đảo đã bị khoét.
- Nhân vật đứng trên phần đảo mất giá đỡ sẽ rơi xuống đất.
- Khi phần còn lại của đảo dưới 18%, đảo bị phá hủy hoàn toàn.
- Đạn dịch chuyển không làm thay đổi địa hình.
## Hệ thống sát thương
- Xác suất CRITICAL cố định: 30% cho mọi nhân vật.
- CRITICAL: 150% sát thương.
- Bonus vòng cầu dựa trên góc rơi thực tế của viên đạn tại điểm va chạm.
- Góc rơi ≤ 50°: 100% sát thương.
- Góc rơi 50–90°: tăng tuyến tính từ 100% đến 200%.
- CRITICAL và vòng cầu cộng dồn, tổng tối đa 300% sát thương cơ bản.
- Hiển thị chữ CRITICAL, hệ số vòng cầu, sát thương cuối và hiệu ứng lửa trên đạn.
## Bản đồ
Bổ sung 7 chủ đề mới: Rừng rậm, Hẻm núi, Mặt trăng, Thung lũng pha lê, Bão giông, Quần đảo trên không và Đất đỏ hiểm trở. Tổng cộng 12 chủ đề, chưa tính lựa chọn Ngẫu nhiên.
## Đồng bộ máy chủ
- Máy chủ online là nơi quyết định CRITICAL, hệ số vòng cầu, sát thương và phần đảo bị phá.
- `server.bundle.js` được tái tạo từ mã nguồn v1.4.0 và vẫn chạy độc lập không cần npm.
