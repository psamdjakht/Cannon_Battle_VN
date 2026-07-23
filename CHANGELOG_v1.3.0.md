# Cannon Battle VN v1.3.0
## Sửa lỗi nghiêm trọng
- Sửa treo toàn bộ trận ở chế độ 1 người đấu máy sau khi dùng đạn dịch chuyển.
- Trạng thái trận không còn phụ thuộc vào callback hoạt ảnh của Canvas.
- Điểm rơi và chuyển lượt có bộ hẹn giờ độc lập, thao tác hoàn tất lặp lại an toàn và watchdog tự cứu lượt nếu hoạt ảnh hoặc requestAnimationFrame lỗi.
- Nhân vật chỉ chuyển tới điểm đạn rơi khi viên đạn chạm bề mặt hợp lệ.
- Online dùng máy chủ làm nguồn trạng thái; tín hiệu hoàn tất hoạt ảnh từ điện thoại không còn quyết định chuyển lượt.
## Bản đồ và camera
- Chiều ngang thế giới tăng từ 960 lên 1.920 đơn vị.
- Camera mặc định bám người đang có lượt; khi bắn camera bám theo viên đạn.
- Thêm nút giữ `🔭 TOÀN CẢNH` ở góc trái dưới bản đồ; camera zoom mượt từ vị trí hiện tại ra toàn bộ chiều ngang bản đồ.
- Có thể giữ nút toàn cảnh bằng một ngón và giữ nút BẮN bằng ngón khác.
- Phím V trên máy tính dùng để giữ xem toàn cảnh.
## Tầm bắn
- Lực tối đa tăng lên 1.050 để bắn xuyên suốt bản đồ rộng.
- Thời gian giữ nút BẮN tăng lên 2,6 giây để điều chỉnh lực xa chính xác hơn.
- Quỹ đạo máy và máy chủ cùng dùng giới hạn lực mới.
## Giao diện điện thoại
- Các nút quay nòng, đạn dịch chuyển, bắn và toàn cảnh dùng nền trong suốt có làm mờ nhẹ.
- Màn hình dọc: bản đồ ở trên, cụm điều khiển nằm thành vùng riêng phía dưới, không che nhân vật.
- Màn hình ngang: bản đồ ở bên trái, cụm điều khiển gọn ở bên phải, không đè lên vùng chơi.
- Khóa cuộn trang và hỗ trợ đa chạm giữ zoom + giữ lực cùng lúc.
