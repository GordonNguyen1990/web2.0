
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
    const { type, message, admin_id } = await req.json();

    if (!supabaseUrl || !supabaseServiceKey || !telegramBotToken) {
         return new Response("Server Config Error", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Admin's Chat ID to confirm
    const { data: adminUser } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', admin_id)
        .single();

    if (adminUser && adminUser.telegram_chat_id) {
        await sendTelegramMessage(adminUser.telegram_chat_id, `📢 **Hệ thống cập nhật**\n\n${message}`);
    }

    return new Response("OK", { status: 200 });

  } catch (error: any) {
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
