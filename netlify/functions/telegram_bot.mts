
type Context = { geo?: { city?: string; country?: { code?: string } } };
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

export default async (req: Request, context: Context) => {
  // Only allow POST requests (Webhooks)
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const update = await req.json();

    if (!update.message || !update.message.text) {
      return new Response("OK", { status: 200 }); // Ignore non-text updates
    }

    const chatId = update.message.chat.id;
    const username = update.message.chat.username;
    const text = update.message.text;

    // Logic: Handle /start <uuid>
    // Update: Allow "start" without slash for testing convenience
    const normalizedText = text.trim();
    if (normalizedText.toLowerCase().startsWith("/start") || normalizedText.toLowerCase() === "start") {
        const parts = normalizedText.split(" ");
        if (parts.length >= 2) {
            const userId = parts[1];
            
            // 1. Validate UUID format (simple check)
            if (userId.length < 10) { 
                 await sendTelegramMessage(chatId, "❌ Link không hợp lệ. Vui lòng thử lại từ Website.");
                 return new Response("OK", { status: 200 });
            }

            // 2. Connect to Supabase
            if (!supabaseUrl || !supabaseServiceKey) {
                await sendTelegramMessage(chatId, "❌ Lỗi: Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
                return new Response("Server Config Error", { status: 500 });
            }

            // Check URL format
            if (!supabaseUrl.includes(".supabase.co")) {
                 await sendTelegramMessage(chatId, `❌ Lỗi Config: SUPABASE_URL có vẻ sai định dạng (Phải là https://xxx.supabase.co). Giá trị hiện tại: ${supabaseUrl}`);
                 return new Response("Config Error", { status: 500 });
            }

            const supabase = createClient(supabaseUrl, supabaseServiceKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            });

            // 2.1 Test Connection & User Existence
            const { data: userCheck, error: checkError } = await supabase
                .from('profiles')
                .select('id, role')
                .eq('id', userId)
                .single();

            if (checkError) {
                await sendTelegramMessage(chatId, `❌ Lỗi Kiểm tra User: ${JSON.stringify(checkError, null, 2)} \n\n(Khả năng cao là sai ID hoặc sai Key)`);
                return new Response("OK", { status: 200 });
            }

            if (!userCheck) {
                 await sendTelegramMessage(chatId, "❌ Không tìm thấy User ID này trong hệ thống.");
                 return new Response("OK", { status: 200 });
            }

            // 3. Update Profile
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    telegram_chat_id: chatId.toString(),
                    telegram_username: username
                })
                .eq('id', userId);

            if (error) {
                console.error("Supabase Update Error:", error);
                await sendTelegramMessage(chatId, `❌ Lỗi chi tiết: ${JSON.stringify(error, null, 2)}`);
            } else {
                await sendTelegramMessage(chatId, "✅ Tài khoản đã được liên kết thành công! Bạn sẽ nhận được thông báo biến động số dư tại đây.");
            }
        } else {
            await sendTelegramMessage(chatId, "👋 Chào mừng! Hãy bấm nút 'Kết nối Bot' từ Website để bắt đầu.");
        }
    }

    return new Response("OK", { status: 200 });

  } catch (error: any) {
    console.error("Telegram Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

async function sendTelegramMessage(chatId: number | string, text: string) {
    if (!process.env.TELEGRAM_BOT_TOKEN) return;
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text })
    });
}
