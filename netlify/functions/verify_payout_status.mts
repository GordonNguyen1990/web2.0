
import { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req: Request, context: Context) => {
  // Allow GET for polling or POST
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const payoutId = url.searchParams.get("payout_id") || (await req.json()).payout_id;

    if (!payoutId) {
      return new Response(JSON.stringify({ error: "Missing payout_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Authenticate with NOWPayments
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

    // Check Payout Status
    const statusRes = await fetch(`https://api.nowpayments.io/v1/payout/${payoutId}`, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${token}`
        }
    });

    const statusData = await statusRes.json();

    if (!statusRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to check status", details: statusData }), { status: 502 });
    }

    // statusData.withdrawals is an array. We usually assume 1 withdrawal per payout request in this flow.
    // If it's a batch, we need to handle accordingly. But create_withdrawal makes 1 request.
    const withdrawal = statusData.withdrawals && statusData.withdrawals[0];
    
    if (!withdrawal) {
        // If no withdrawals found in payout, maybe it's still processing or invalid ID
        return new Response(JSON.stringify({ status: statusData.status || "UNKNOWN", details: statusData }), { status: 200 });
    }

    const currentStatus = withdrawal.status; // FINISHED, REJECTED, CREATING, etc.

    if (currentStatus === 'FINISHED') {
        if (!supabaseServiceKey || !supabaseUrl) {
             return new Response(JSON.stringify({ error: "Server Config Error" }), { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Update Transaction to COMPLETED
        await supabase
            .from('transactions')
            .update({ status: 'COMPLETED' })
            .eq('tx_hash', payoutId);
            
        return new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 200 });
    } else if (currentStatus === 'REJECTED' || currentStatus === 'FAILED') {
        if (!supabaseServiceKey || !supabaseUrl) {
             return new Response(JSON.stringify({ error: "Server Config Error" }), { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Update Transaction to FAILED and Refund
        // First get the transaction to know user_id and amount
        const { data: tx } = await supabase.from('transactions').select('*').eq('tx_hash', payoutId).single();
        
        if (tx && tx.status !== 'FAILED') {
            await supabase.from('transactions').update({ status: 'FAILED' }).eq('id', tx.id);
            
            // Refund balance
            const { data: user } = await supabase.from('profiles').select('balance').eq('id', tx.user_id).single();
            if (user) {
                await supabase.from('profiles').update({ balance: user.balance + tx.amount }).eq('id', tx.user_id);
            }
        }
        return new Response(JSON.stringify({ status: 'FAILED' }), { status: 200 });
    }

    return new Response(JSON.stringify({ status: currentStatus }), { status: 200 });

  } catch (error: any) {
    console.error("Verify Payout Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
