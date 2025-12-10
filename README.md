# Dola Style - Backend API (Node.js + Express)

Đây là backend server cung cấp API cho dự án **Dola Style**, sử dụng cơ sở dữ liệu **MongoDB**.

## 🚀 Công Nghệ Sử Dụng

-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Database**: MongoDB (Mongoose ODM)
-   **Authentication**: JWT, BCrypt
-   **Repository**: [Backend GitHub](https://github.com/myBlance/fashion_be.git)

---

## 🛠️ Hướng Dẫn Cài Đặt

### 1. Yêu cầu
-   Node.js (v16 trở lên)
-   MongoDB (đang chạy local hoặc cloud)

### 2. Cài đặt Packages
Tại thư mục `backend`, chạy lệnh:
```bash
npm install
```

### 3. Cấu hình môi trường
Tạo file `.env` trong thư mục `backend` với nội dung mẫu:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/fashion_db
JWT_SECRET=your_super_secret_key_here
```

### 4. Chạy Server
-   Chạy môi trường Dev (nó sẽ tự restart khi sửa code):
    ```bash
    npm run dev
    ```
-   Chạy môi trường Prod:
    ```bash
    npm start
    ```
Server API sẽ lắng nghe tại: `http://localhost:5000`

---

## 📂 API Endpoints Chính

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| **Auth** | `/api/auth` | Đăng nhập, Đăng ký |
| **Products** | `/api/products` | CRUD Sản phẩm |
| **Orders** | `/api/orders` | Tạo và quản lý đơn hàng |
| **Categories** | `/api/categories` | (Nếu có) Quản lý danh mục |
| **Upload** | `/api/products` | Upload ảnh (multipart/form-data) |
| **Stats** | `/api/admin/stats` | Thống kê Dashboard |

---

## 📂 Cấu Trúc Thư Mục

```
src/
├── Controller/    # Logic xử lý chính cho từng chức năng
├── middleware/    # Middleware (Auth, Upload...)
├── models/        # Định nghĩa Schema cho MongoDB
├── routes/        # Định tuyến API
└── app.js         # File khởi tạo ứng dụng Express
```

---
*Dola Style Backend*
