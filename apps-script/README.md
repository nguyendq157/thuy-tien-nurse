# Cài đặt Apps Script (đọc + ghi Google Sheet)

1. Mở Google Sheet → **Tiện ích mở rộng → Apps Script**.
2. Xóa code mẫu, dán toàn bộ nội dung `Code.gs` rồi lưu.
3. **Cài đặt dự án (⚙) → Thuộc tính tập lệnh → Thêm thuộc tính**:
   - Tên: `SECRET_TOKEN`
   - Giá trị: một chuỗi bí mật dài do bạn tự đặt (không dùng mật khẩu thật của bạn).
4. **Triển khai → Triển khai mới → Loại: Ứng dụng web**:
   - Thực thi dưới tên: **Tôi**
   - Ai có quyền truy cập: **Bất kỳ ai**
   - Bấm Triển khai, cấp quyền khi Google hỏi, rồi sao chép **URL ứng dụng web** (kết thúc bằng `/exec`).
5. Trong app, bấm **📄 Google Sheet**, dán URL và `SECRET_TOKEN`, bấm **⬇ Tải dữ liệu**.

Sau khi tải thành công, mỗi thay đổi trong app sẽ tự lưu lên Sheet sau khoảng 1,5 giây.
Nếu sửa `Code.gs`, phải tạo **bản triển khai mới** thì thay đổi mới có hiệu lực.

Lưu ý:
- Mỗi lần mở app, dữ liệu mới nhất từ Sheet sẽ ghi đè dữ liệu cục bộ.
- Lưu lên Sheet sẽ ghi đè các tab `DieuDuong`, `BenhNhan`, `Thuoc`, `Ca`. Không để dữ liệu khác trong các tab này.
- Dấu "Đã thực hiện" của cữ thuốc chỉ lưu trên trình duyệt, không đồng bộ lên Sheet.
