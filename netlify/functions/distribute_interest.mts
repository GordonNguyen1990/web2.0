
// @ts-ignore
import { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response("Server Config Error", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { interestRatePercent, admin_id } = await req.json();

    if (!interestRatePercent) {
        return new Response("Missing interest rate", { status: 400 });
    }

    // 1. Get all users with balance > 0
    const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id, balance, telegram_chat_id')
        .gt('balance', 0);

    if (userError || !users) {
        throw new Error("Failed to fetch users: " + userError?.message);
    }

    const dailyRate = interestRatePercent / 30 / 100;
    let totalDistributed = 0;
    let userCount = 0;

    // 2. Process each user
    for (const user of users) {
        const interestAmount = user.balance * dailyRate;
        
        if (interestAmount < 0.01) continue; // Skip too small amounts

        const newBalance = user.balance + interestAmount;

        // Update Balance
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', user.id);

        if (updateError) {
            console.error(`Failed to update balance for user ${user.id}`, updateError);
            continue;
        }

        // Insert Transaction (This triggers notify_transaction via Webhook)
        const { error: txError } = await supabase
            .from('transactions')
            .insert({
                user_id: user.id,
                type: 'INTEREST',
                amount: interestAmount,
                status: 'COMPLETED',
                date: new Date().toISOString(),
                description: `Lợi nhuận ngày ${new Date().toLocaleDateString('vi-VN')}`
            });

        if (txError) {
             console.error(`Failed to insert tx for user ${user.id}`, txError);
        } else {
            totalDistributed += interestAmount;
            userCount++;
        }
    }

    // 3. Notify Admin
    if (admin_id) {
         // Optionally notify admin about the run
    }

    return new Response(JSON.stringify({ 
        message: "Success", 
        processed: userCount, 
        total_distributed: totalDistributed 
    }), { status: 200 });

  } catch (error: any) {
    console.error("Distribute Interest Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
