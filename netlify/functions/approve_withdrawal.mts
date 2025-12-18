
import { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { transaction_id, admin_id } = await req.json();

    if (!transaction_id || !admin_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    if (!supabaseServiceKey || !supabaseUrl) {
         return new Response(JSON.stringify({ error: "Server Config Error" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify Admin
    const { data: adminUser } = await supabase.from('profiles').select('role').eq('id', admin_id).single();
    if (!adminUser || adminUser.role !== 'ADMIN') {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    // 2. Get Transaction Details
    const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transaction_id)
        .single();

    if (txError || !tx) {
        return new Response(JSON.stringify({ error: "Transaction not found" }), { status: 404 });
    }

    if (tx.status !== 'PENDING') {
        return new Response(JSON.stringify({ error: "Transaction is not pending" }), { status: 400 });
    }

    const withdrawalAddress = tx.metadata?.wallet_address || (tx.description.split(': ')[1]);
    if (!withdrawalAddress) {
        return new Response(JSON.stringify({ error: "Target wallet address not found in transaction" }), { status: 400 });
    }

    // 3. Authenticate with NOWPayments to get Token
    const npEmail = process.env.NOWPAYMENTS_EMAIL;
    const npPassword = process.env.NOWPAYMENTS_PASSWORD;

    if (!npEmail || !npPassword) {
         return new Response(JSON.stringify({ error: "Server Config Error: Missing NOWPayments Credentials" }), { status: 500 });
    }

    const authRes = await fetch('https://api.nowpayments.io/v1/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: npEmail, password: npPassword })
    });

    const authData = await authRes.json();
    if (!authData.token) {
        return new Response(JSON.stringify({ error: "NOWPayments Auth Failed", details: authData }), { status: 502 });
    }
    const token = authData.token;

    // 4. Create Payout
    // Payouts API: POST https://api.nowpayments.io/v1/payout
    const payoutRes = await fetch('https://api.nowpayments.io/v1/payout', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            withdrawals: [
                {
                    address: withdrawalAddress,
                    currency: "usdtbsc", // Enforce USDT BEP20
                    amount: tx.amount,
                    ipn_callback_url: "https://your-site.netlify.app/.netlify/functions/ipn_handler" // Optional
                }
            ]
        })
    });

    const payoutData = await payoutRes.json();

    if (!payoutRes.ok) {
         return new Response(JSON.stringify({ error: "Payout Failed", details: payoutData }), { status: 502 });
    }

    // 5. Update Transaction Status
    // payoutData.id is the Batch ID. Individual withdrawals are in payoutData.withdrawals
    const payoutId = payoutData.id; 

    const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
            status: 'COMPLETED', // Or PROCESSING, but assuming success for now
            tx_hash: payoutId,
            description: `${tx.description} (Payout ID: ${payoutId})`
        })
        .eq('id', transaction_id);

    if (updateError) {
        console.error("Failed to update TX status after payout:", updateError);
    }

    return new Response(JSON.stringify({ status: "SUCCESS", payout_data: payoutData }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Approve Withdrawal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
