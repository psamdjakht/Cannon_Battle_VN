# Cannon Battle VN

Game pháo binh theo lượt được phát triển từ ý tưởng/cơ chế của HOT CANNONS, bổ sung nhân vật hoạt ảnh, đấu máy và phòng online 2–6 người.

## Chức năng chính

- Chế độ **1 người đấu máy** với ba mức Dễ, Vừa, Khó.
- Chế độ **tạo phòng online** bằng mã 6 ký tự, hỗ trợ 2–6 người.
- Chủ phòng chọn:
  - Máu ban đầu: 50–500.
  - Máu mất khi trúng: người tạo phòng nhập từ 5–200.
  - Thời gian mỗi lượt: 20–60 giây.
  - Số người tối đa, mật khẩu phòng và loại bản đồ.
- 22 nhân vật, mỗi nhân vật có 5 khung chuyển động.
- Nhân vật và pháo dùng chung tọa độ; pháo được vẽ trước, nhân vật vẽ đè phía trước.
- Địa hình bị phá hủy sau vụ nổ.
- Có gió, thanh máu, đếm giờ, hoạt ảnh bay của đạn, rung/hiệu ứng nổ và âm thanh tạo bằng Web Audio.

## Điều khiển

### Điện thoại

- Vuốt ngang trên bản đồ: nhân vật và pháo cùng di chuyển.
- Vuốt hoặc giữ kéo dọc: chỉnh góc nòng.
- Nhấn giữ nút **BẮN**: giữ càng lâu lực càng lớn; thả tay để bắn.

### Vi tính

- `←` / `→`: di chuyển.
- `↑` / `↓`: chỉnh góc.
- Giữ `Space`: lấy lực; thả `Space`: bắn.

## Chạy trên máy tính

Yêu cầu Node.js 20 trở lên.

```bash
npm install
npm start
```

Mở `http://localhost:10000`.

## Deploy bằng Render Blueprint

1. Tạo repository GitHub mới.
2. Upload toàn bộ nội dung thư mục này lên nhánh `main`.
3. Trong Render chọn **New > Blueprint**.
4. Chọn repository vừa tạo.
5. Render đọc `render.yaml`, tự cài thư viện và chạy `npm start`.
6. Khi deploy xong, mở link Render để chơi. Phòng online chỉ hoạt động khi mọi người truy cập cùng link Render.

## Cấu trúc

- `server.js`: máy chủ phòng online, lượt chơi, vật lý đạn và sát thương.
- `public/index.html`: giao diện.
- `public/style.css`: giao diện responsive điện thoại/vi tính.
- `public/js/game.js`: game Canvas, đấu máy, điều khiển, hoạt ảnh.
- `public/assets/animals`: 22 bộ nhân vật.
- `render.yaml`: cấu hình Render Blueprint.

## Ghi chú kỹ thuật

- Máy chủ là nguồn dữ liệu chính trong chế độ online: vị trí, góc, quỹ đạo, sát thương và địa hình đều được xác thực ở máy chủ.
- Phòng được giữ trong RAM. Với gói Render Free, dịch vụ có thể ngủ khi không có truy cập; phòng đang lưu trong RAM sẽ mất khi dịch vụ ngủ hoặc khởi động lại. Đây là thiết kế phù hợp cho game nội bộ, không cần đăng nhập hay cơ sở dữ liệu.
- Nên chơi điện thoại ở chế độ ngang để thấy bản đồ và nút bắn rõ hơn.

## Giấy phép và nguồn tham khảo

Cơ chế pháo binh được tham khảo từ dự án HOT CANNONS của COMSM0166 Group 17 theo giấy phép MIT. Nội dung giấy phép gốc nằm trong `THIRD_PARTY_LICENSE_HOT_CANNONS.txt`.
