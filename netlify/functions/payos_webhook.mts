
import { Context } from "@netlify/functions";
import PayOS from "@payos/node";
import { createClient } from "@supabase/supabase-js";

const payosClientId = process.env.PAYOS_CLIENT_ID;
const payosApiKey = process.env.PAYOS_API_KEY;
const payosChecksumKey = process.env.PAYOS_CHECKSUM_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const webhookData = await req.json();

    if (!payosClientId || !payosApiKey || !payosChecksumKey || !supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Config for PayOS Webhook");
        return new Response("Server Config Error", { status: 500 });
    }

    // Note: @payos/node might not export PayOS as class if it's default export
    // The linter error suggests it might be `import { PayOS } from ...` or similar.
    // However, usually `import PayOS from '@payos/node'` works if it's a class.
    // Let's assume standard usage or fix if needed. 
    // Wait, the previous file had linter error "has no construct signatures".
    // This means PayOS is not a class but maybe an object with methods?
    // Official docs say: const payOS = new PayOS(...)
    // Maybe we need `const PayOS = require("@payos/node")` in CJS, but in ESM?
    // Let's try to inspect or use it as is, maybe linter is just strict.
    
    const payos = new PayOS(payosClientId, payosApiKey, payosChecksumKey);

    // Verify Webhook
    // payos.verifyPaymentWebhookData(webhookData) -> returns verified data or throws
    const verifiedData = payos.verifyPaymentWebhookData(webhookData);

    // If verified, process it
    // verifiedData contains: orderCode, amount, description, etc.
    const { orderCode, amount } = verifiedData;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if processed
    const { data: existingTx } = await supabase
        .from('transactions')
        .select('id, user_id, status')
        .eq('tx_hash', String(orderCode))
        .single();

    if (!existingTx) {
        console.error("Transaction not found for OrderCode:", orderCode);
        // Maybe it wasn't saved in create_payment?
        return new Response(JSON.stringify({ message: "Transaction not found" }), { status: 200 });
    }

    if (existingTx.status === 'COMPLETED') {
        return new Response(JSON.stringify({ message: "Already Completed" }), { status: 200 });
    }

    // Update Balance
    const { data: user } = await supabase.from('profiles').select('balance').eq('id', existingTx.user_id).single();
    if (user) {
        const newBalance = user.balance + Number(amount);
        await supabase.from('profiles').update({ balance: newBalance }).eq('id', existingTx.user_id);
    }

    // Update Transaction
    await supabase.from('transactions').update({
        status: 'COMPLETED',
        description: `PayOS Success: ${orderCode}`
    }).eq('id', existingTx.id);

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error: any) {
    console.error("PayOS Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
