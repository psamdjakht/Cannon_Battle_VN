# Cannon Battle VN v1.2.1

## Sửa lỗi nghiêm trọng
- Thay luồng hoàn tất cú bắn online bằng trạng thái duy nhất theo `shotId`; một cú bắn chỉ được hoàn tất và chuyển lượt đúng một lần.
- Loại bỏ xung đột giữa timer cũ, tín hiệu kết thúc hoạt ảnh và watchdog khiến phòng bị đứng sau đạn dịch chuyển.
- Máy chủ là nguồn xác thực: tính điểm rơi, chờ đạn đáp, cập nhật tọa độ người bắn, phát trạng thái mới cho toàn phòng rồi mới chuyển lượt.
- Nếu điện thoại không gửi tín hiệu kết thúc hoạt ảnh, timer và watchdog máy chủ vẫn tự hoàn tất cú bắn.

## Điểm đáp dịch chuyển
- Không còn dùng giới hạn chênh cao của cơ chế đi bộ để kiểm tra điểm dịch chuyển.
- Ưu tiên đúng tọa độ đạn rơi trên mặt đất hoặc đảo bay.
- Chỉ tìm vị trí gần nhất khi điểm chính xác bị người khác chiếm hoặc nằm quá sát mép đảo.
- Đồng bộ vị trí mới trên tất cả thiết bị trước khi bắt đầu lượt kế tiếp.

## Trình duyệt di động
- Thêm mã phiên bản vào CSS, Socket.IO và `game.js` để tránh iPhone giữ file cũ sau khi deploy.
