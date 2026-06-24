# Hệ thống xét Sinh viên 5 tốt

Ứng dụng web gồm **frontend** (GitHub Pages) và **backend** (Google Apps Script + Google Sheets + Google Drive).

## Cấu trúc thư mục

```
HTSV5T/
├── index.html              ← Trang web (GitHub Pages)
├── google-apps-script/
│   └── Code.gs             ← Backend (dán vào Apps Script)
└── README.md
```

## Bước 1 — Triển khai Backend (Google Apps Script)

1. Mở [Google Apps Script](https://script.google.com/) → **Dự án mới**.
2. Xóa nội dung mặc định, dán toàn bộ file `google-apps-script/Code.gs`.
3. Chọn hàm `setupSV5T` → bấm **Chạy** (Run).
   - Lần đầu cần **cấp quyền** Google (Sheets, Drive).
   - Hệ thống tự tạo Google Sheet, thư mục Drive, tiêu chí và tài khoản admin.
4. **Triển khai** (Deploy) → **Triển khai mới** → **Ứng dụng web**:
   - **Thực thi với tư cách:** Tôi (Me)
   - **Ai có quyền truy cập:** Bất kỳ ai (Anyone)
5. Sao chép URL dạng `https://script.google.com/macros/s/.../exec`.

**Tài khoản admin mặc định:** `admin` / `123456`

## Bước 2 — Cấu hình Frontend

Mở `index.html`, tìm dòng:

```javascript
const DEFAULT_API_URL = '';
```

Dán URL `/exec` từ bước 1 vào giữa dấu nháy, ví dụ:

```javascript
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

Lưu file.

## Bước 3 — Đưa lên GitHub Pages

### Cách nhanh (Windows)

Double-click file **`DAY-LEN-GITHUB.bat`** trong thư mục project:
- Đăng nhập GitHub (nếu được hỏi)
- Tạo repo **SV5T-DNTU** và push code

### Cách thủ công

1. Tạo repository **SV5T-DNTU** trên GitHub (public)
2. Push code:
   ```bash
   git remote add origin https://github.com/<username>/SV5T-DNTU.git
   git branch -M main
   git push -u origin main
   ```
3. Vào **Settings** → **Pages**:
   - **Source:** Deploy from a branch
   - **Branch:** `main` / thư mục `/ (root)`
4. Sau vài phút, trang chạy tại: `https://<username>.github.io/SV5T-DNTU/`

## Kiểm tra nhanh

- Mở trang GitHub Pages → tab **Sinh viên** / **Quản lý** hiển thị bình thường.
- Đăng nhập admin: `admin` / `123456`.
- Nếu báo *"Chưa cấu hình Apps Script Web App URL"* → kiểm tra lại `DEFAULT_API_URL` trong `index.html`.

## Lưu ý

- Frontend **không cần build** — chỉ cần file `index.html`.
- Backend **bắt buộc** chạy trên Google Apps Script; GitHub Pages chỉ host giao diện.
- File minh chứng lưu trên Google Drive của tài khoản triển khai Apps Script.
- Dữ liệu nằm trong Google Sheet do `setupSV5T()` tạo.
