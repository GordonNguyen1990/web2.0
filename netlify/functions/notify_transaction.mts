
import { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    
    // Supabase Webhook Payload structure: { type: 'INSERT' | 'UPDATE', table: 'transactions', record: { ... }, old_record: { ... } }
    const record = payload.record;
    
    if (!record || !record.user_id) {
        return new Response("Invalid Payload", { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey || !telegramBotToken) {
         return new Response("Server Config Error", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get User's Chat ID
    const { data: user, error } = await supabase
        .from('profiles')
        .select('telegram_chat_id, balance')
        .eq('id', record.user_id)
        .single();

    if (error || !user || !user.telegram_chat_id) {
        console.log("User has no telegram linked or not found:", record.user_id);
        return new Response("Skipped: No Telegram Linked", { status: 200 });
    }

    // 2. Construct Message
    let message = "";
    if (payload.type === 'INSERT') {
        // New Transaction
        message = `🆕 **Giao dịch mới**\n\n` +
                  `Loại: ${record.type}\n` +
                  `Số tiền: $${Number(record.amount).toLocaleString()}\n` +
                  `Trạng thái: ${record.status}\n\n` +
                  `💰 Số dư hiện tại: $${Number(user.balance).toLocaleString()}`;
    } else if (payload.type === 'UPDATE' && record.status !== payload.old_record?.status) {
        // Status Update (e.g., PENDING -> COMPLETED)
        const statusIcon = record.status === 'COMPLETED' ? '✅' : record.status === 'FAILED' ? '❌' : '⏳';
        message = `${statusIcon} **Cập nhật trạng thái**\n\n` +
                  `Loại: ${record.type}\n` +
                  `Số tiền: $${Number(record.amount).toLocaleString()}\n` +
                  `Trạng thái: ${payload.old_record.status} ➡️ ${record.status}\n\n` +
                  `💰 Số dư hiện tại: $${Number(user.balance).toLocaleString()}`;
    } else {
        return new Response("Skipped: Irrelevant Update", { status: 200 });
    }

    // 3. Send Message
    await sendTelegramMessage(user.telegram_chat_id, message);

    return new Response("OK", { status: 200 });

  } catch (error: any) {
    console.error("Notify Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

async function sendTelegramMessage(chatId: string, text: string) {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            chat_id: chatId, 
            text: text,
            parse_mode: 'Markdown'
        })
    });
}
