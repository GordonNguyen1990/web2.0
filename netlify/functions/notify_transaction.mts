
// Netlify Functions Context type is not used in the handler body, so we can omit the import
// If you need it later, install @netlify/functions or define a minimal type yourself.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

export default async (req: Request, context?: any) => {
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

    // 2. Construct Message based on Transaction Type & Status
    let message = "";
    const amount = Number(record.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const balance = Number(user.balance).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    // DEBUG LOG
    console.log(`Processing Notify: Type=${payload.type}, TxType=${record.type}, Status=${record.status}`);

    // Case 1: DEPOSIT Success (Approved or Instant)
    if (record.type === 'DEPOSIT' && record.status === 'COMPLETED') {
        message = `✅ <b>Nạp tiền thành công!</b>\n\n` +
                  `Tài khoản của bạn vừa được cộng: <b>${amount}</b>\n` +
                  `------------------------------\n` +
                  `💰 Số dư hiện tại: <b>${balance}</b>`;
    }
    // Case 2: WITHDRAW Success (Approved)
    else if (record.type === 'WITHDRAW' && record.status === 'COMPLETED' && payload.type === 'UPDATE') {
        message = `💸 <b>Rút tiền thành công!</b>\n\n` +
                  `Yêu cầu rút <b>${amount}</b> đã được duyệt.\n` +
                  `Tiền đang được chuyển về ví của bạn.`;
    }
    // Case 3: INTEREST Received (System Profit)
    else if (record.type === 'INTEREST' && payload.type === 'INSERT') {
        message = `📈 <b>Lợi nhuận hệ thống!</b>\n\n` +
                  `Chúc mừng! Bạn vừa nhận được: <b>${amount}</b> tiền lãi.\n` +
                  `------------------------------\n` +
                  `💰 Số dư hiện tại: <b>${balance}</b>`;
    }
    // Case 4: COMMISSION Received (Referral Bonus)
    else if (record.type === 'COMMISSION' && payload.type === 'INSERT') {
        message = `🌹 <b>Hoa hồng giới thiệu!</b>\n\n` +
                  `Tuyệt vời! Bạn nhận được <b>${amount}</b> hoa hồng từ thành viên tuyến dưới.\n` +
                  `------------------------------\n` +
                  `💰 Số dư hiện tại: <b>${balance}</b>`;
    }
    // Case 5: WITHDRAW Rejected
    else if (record.type === 'WITHDRAW' && record.status === 'FAILED' && payload.type === 'UPDATE') {
        message = `❌ <b>Yêu cầu rút tiền bị từ chối</b>\n\n` +
                  `Số tiền <b>${amount}</b> đã được hoàn lại vào tài khoản.\n` +
                  `Lý do: ${record.description || 'Admin từ chối'}\n` +
                  `------------------------------\n` +
                  `💰 Số dư hiện tại: <b>${balance}</b>`;
    }
    // Default: Generic Notification for other cases
    else if (payload.type === 'INSERT') {
        message = `🆕 <b>Giao dịch mới: ${record.type}</b>\n\n` +
                  `Số tiền: <b>${amount}</b>\n` +
                  `Trạng thái: ${record.status}\n` +
                  `💰 Số dư: ${balance}`;
    }
    else if (payload.type === 'UPDATE' && record.status !== payload.old_record?.status) {
         message = `ℹ️ <b>Cập nhật trạng thái: ${record.type}</b>\n\n` +
                   `Trạng thái: ${payload.old_record.status} ➡️ ${record.status}\n` +
                   `Số tiền: <b>${amount}</b>`;
    }

    if (!message) {
        return new Response("Skipped: No message generated", { status: 200 });
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
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            chat_id: chatId, 
            text: text,
            parse_mode: 'HTML'
        })
    });
    
    if (!res.ok) {
        const errText = await res.text();
        console.error("Telegram API Error:", errText);
    }
}
