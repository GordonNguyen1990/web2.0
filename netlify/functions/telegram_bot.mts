
import { Context } from "@netlify/functions";
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
    if (text.startsWith("/start")) {
        const parts = text.split(" ");
        if (parts.length === 2) {
            const userId = parts[1];
            
            // 1. Validate UUID format (simple check)
            if (userId.length < 10) { 
                 await sendTelegramMessage(chatId, "❌ Link không hợp lệ. Vui lòng thử lại từ Website.");
                 return new Response("OK", { status: 200 });
            }

            // 2. Connect to Supabase
            if (!supabaseUrl || !supabaseServiceKey) {
                console.error("Missing Supabase Config");
                return new Response("Server Config Error", { status: 500 });
            }
            const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
                await sendTelegramMessage(chatId, `❌ Lỗi hệ thống: ${error.message}`);
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
