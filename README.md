# Cannon Battle VN

> Phiên bản v1.1.0: bản đồ toàn màn hình, phòng công khai, chơi lại cùng phòng, đảo bay, bản đồ ngẫu nhiên và đạn dịch chuyển. Render chạy bằng `server.bundle.js`, không cần tải dependency từ npm.

Game pháo binh theo lượt, hỗ trợ một người đấu máy và phòng online 2–6 người. Nhân vật hoạt ảnh đứng phía trước khẩu pháo; nhân vật và pháo di chuyển đồng bộ.

## Chức năng chính

- **Một người đấu máy** với ba mức Dễ, Vừa, Khó.
- **Phòng online 2–6 người**; danh sách phòng đang mở xuất hiện ngay tại menu, vẫn có ô nhập mã thủ công khi cần.
- Chủ phòng có thể **chơi lại trong cùng phòng**; toàn bộ người còn kết nối được đưa vào ván mới và khôi phục máu, vị trí, lượt cùng số đạn dịch chuyển.
- Mỗi người có **3 đạn dịch chuyển**. Bật chế độ trước khi bắn; đạn chạm đâu thì người bắn dịch chuyển tới bề mặt an toàn gần đó. Đạn dịch chuyển không gây sát thương.
- Máy có thể dùng đạn dịch chuyển theo tình huống: đổi vị trí, lên đảo hoặc rút khỏi vị trí bất lợi.
- **Đạn thường** có hiệu ứng lửa, sóng xung kích và vòng bán kính nổ rõ; sát thương vẫn theo mức chủ phòng chọn.
- Góc bắn mở rộng từ **2° đến 89°**, điều chỉnh nhanh và nhạy hơn.
- Nòng pháo dài hơn, có đầu nòng và đường chỉ hướng vẽ nổi trên nhân vật để không bị các nhân vật lớn che khuất.
- Giao diện chơi **khóa toàn màn hình**, không kéo trượt trang. Gió, thời gian, góc, lực và mẹo điều khiển được hiển thị ngay trong khu vực bản đồ.
- Bản đồ: đồi cỏ, sa mạc, núi tuyết, núi lửa, **đảo bay chiến thuật** và **ngẫu nhiên**.
- Bản đồ ngẫu nhiên tự tạo địa hình mới và đặt người chơi lên bề mặt hợp lệ, không chôn trong đất.
- 22 nhân vật, mỗi nhân vật có 5 khung chuyển động.
- Địa hình mặt đất bị phá hủy sau vụ nổ; các đảo bay là bề mặt chiến thuật để dịch chuyển và bắn từ trên cao.

## Điều khiển

### Điện thoại

- Vuốt ngang trên bản đồ: nhân vật và pháo cùng di chuyển.
- Vuốt hoặc giữ kéo dọc: chỉnh góc nòng.
- Nhấn giữ **BẮN**: giữ càng lâu lực càng lớn; thả tay để bắn.
- Nhấn **ĐẠN DỊCH CHUYỂN**: cú bắn kế tiếp dùng một viên dịch chuyển.

### Vi tính

- `←` / `→`: di chuyển.
- `↑` / `↓`: chỉnh góc.
- Giữ `Space`: lấy lực; thả `Space`: bắn.
- `T`: bật/tắt đạn dịch chuyển cho cú bắn kế tiếp.

## Chạy trên máy tính

Yêu cầu Node.js 20.

```bash
node server.bundle.js
```

Mở `http://localhost:10000`.

## Deploy lên Render

1. Upload toàn bộ nội dung thư mục này lên thư mục gốc của repository GitHub.
2. Trong Render dùng cấu hình:
   - Build Command: `node --check server.bundle.js && node --check public/js/game.js`
   - Start Command: `node server.bundle.js`
   - Environment: `NODE_VERSION=20.19.5`
3. Chọn **Manual Deploy → Clear build cache & deploy**.

`render.yaml` đã có sẵn các thiết lập trên. Không đặt lại Build Command thành `npm install`.

## Cấu trúc

- `server.js`: mã nguồn máy chủ phòng, lượt, địa hình, đảo bay, đạn và sát thương.
- `server.bundle.js`: bản máy chủ độc lập dùng trực tiếp trên Render.
- `public/index.html`: giao diện.
- `public/style.css`: giao diện responsive và khóa full-map.
- `public/js/game.js`: Canvas, đấu máy, điều khiển, hiệu ứng và AI.
- `public/assets/animals`: 22 bộ nhân vật.
- `render.yaml`: cấu hình Render.

## Ghi chú kỹ thuật

- Trong online, máy chủ quyết định vị trí, góc, quỹ đạo, lượt, sát thương, dịch chuyển và địa hình để các thiết bị nhìn cùng một kết quả.
- Phòng lưu trong RAM. Khi Render khởi động lại hoặc dịch vụ ngủ, các phòng đang mở sẽ mất.
- Bản đồ được thiết kế theo khung 16:9; điện thoại ngang cho vùng quan sát và điều khiển tốt nhất.
- Các đảo bay hiện là bề mặt không bị phá hủy; mặt đất vẫn bị khoét bởi đạn thường.

## Giấy phép và nguồn tham khảo

Cơ chế pháo binh được tham khảo từ dự án HOT CANNONS của COMSM0166 Group 17 theo giấy phép MIT. Nội dung giấy phép gốc nằm trong `THIRD_PARTY_LICENSE_HOT_CANNONS.txt`.
