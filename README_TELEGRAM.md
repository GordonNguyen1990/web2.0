# Hướng dẫn Cài đặt Hệ thống Thông báo Telegram (Serverless - Không cần N8N)

Bạn không cần cài đặt N8N. Hệ thống này sử dụng Netlify Functions có sẵn trong dự án.

## 1. Cấu hình Database (Supabase)
Chạy lệnh SQL sau trong **Supabase SQL Editor** để thêm cột lưu thông tin Telegram:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
```

## 2. Tạo Telegram Bot
1. Chat với `@BotFather` trên Telegram.
2. Gõ `/newbot` và đặt tên (ví dụ: `Web2InvestBot`).
3. BotFather sẽ trả về **API Token** và **Bot Username**.
4. Vào file `.env` (hoặc cấu hình Environment Variables trên Netlify), thêm:
   ```env
   VITE_TELEGRAM_BOT_USERNAME=TenBotCuaBan_bot
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   ```

## 3. Deploy và Lấy URL Functions
Sau khi deploy dự án lên Netlify (hoặc chạy local với `netlify dev`), bạn sẽ có 2 URL functions:
1. `https://your-site.netlify.app/.netlify/functions/telegram_bot` (Xử lý kết nối)
2. `https://your-site.netlify.app/.netlify/functions/notify_transaction` (Gửi thông báo)

*Lưu ý: Nếu chạy Local, bạn cần dùng Ngrok để public cổng 8888 ra internet.*

## 4. Cấu hình Webhook cho Bot Telegram
Bạn cần "nói" cho Telegram biết phải gửi tin nhắn user chat vào đâu.
Mở trình duyệt và truy cập URL sau (thay Token và URL của bạn vào):

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-site.netlify.app/.netlify/functions/telegram_bot
```

Nếu thành công, trình duyệt sẽ báo: `Webhook was set`.

## 5. Cấu hình Webhook trên Supabase
Để hệ thống tự động báo khi có giao dịch:
1. Vào **Database** -> **Webhooks** -> **Create Webhook**.
2. **Name:** Notify Transaction.
3. **Table:** `transactions`.
4. **Events:** `INSERT`, `UPDATE`.
5. **Type:** HTTP Request.
6. **Method:** POST.
7. **URL:** `https://your-site.netlify.app/.netlify/functions/notify_transaction`
8. **HTTP Headers:** Thêm header `Content-Type: application/json` (nếu cần).

---
## Kiểm thử
1. Đăng nhập Web App -> Cài đặt -> Bấm **Kết nối Bot**.
2. Telegram sẽ mở ra, bấm **Start**.
3. Nếu thành công, Bot sẽ chat lại: "✅ Tài khoản đã được liên kết...".
4. Thử nạp tiền hoặc tạo lệnh rút, Bot sẽ báo về ngay lập tức.
