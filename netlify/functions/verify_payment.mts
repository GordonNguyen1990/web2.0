
import { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin Client
const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req: Request, context: Context) => {
  // Allow GET for polling or POST
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const paymentId = url.searchParams.get("payment_id") || (await req.json()).payment_id;

    if (!paymentId) {
      return new Response(JSON.stringify({ error: "Missing payment_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server Config Error: Missing API Key" }), { status: 500 });
    }

    // 1. Verify Status directly with NOWPayments (Source of Truth)
    const npResponse = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
        headers: { "x-api-key": apiKey }
    });
    
    const npData = await npResponse.json();
    
    if (!npResponse.ok) {
        return new Response(JSON.stringify({ error: "Failed to verify with NOWPayments", details: npData }), { status: 502 });
    }

    const { payment_status, pay_amount, price_amount, order_id } = npData;

    // 2. Check if finished
    if (payment_status === "finished" || payment_status === "confirmed") {
        
        if (!supabaseServiceKey || !supabaseUrl) {
             return new Response(JSON.stringify({ error: "Server Config Error: Missing DB Credentials" }), { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 3. Idempotency Check: Check if we already processed this payment_id
        // We use a 'transactions' table. If it doesn't exist, this might fail, so we need to handle that.
        
        const { data: existingTx } = await supabase
            .from('transactions')
            .select('id')
            .eq('tx_hash', paymentId) // We use tx_hash column to store payment_id for uniqueness
            .single();

        if (existingTx) {
            return new Response(JSON.stringify({ status: "ALREADY_PROCESSED", message: "Payment already credited" }), { status: 200 });
        }

        // 4. Process: Add Balance
        // Get User
        const { data: user } = await supabase.from('profiles').select('balance').eq('id', order_id).single();
        
        if (!user) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
        }

        const depositAmount = price_amount || pay_amount;
        const newBalance = (Number(user.balance) || 0) + Number(depositAmount);

        // Update Balance
        const { error: balanceError } = await supabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', order_id);

        if (balanceError) {
            throw balanceError;
        }

        // 5. Record Transaction to prevent double-spending
        // Note: You MUST create a 'transactions' table in Supabase for this to work securely.
        await supabase.from('transactions').insert({
            user_id: order_id,
            type: 'DEPOSIT',
            amount: depositAmount,
            status: 'COMPLETED',
            tx_hash: paymentId, // Key for uniqueness
            description: `NOWPayments Deposit`
        });

        return new Response(JSON.stringify({ status: "SUCCESS", new_balance: newBalance }), { 
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    }

    // If waiting or other status
    return new Response(JSON.stringify({ status: payment_status }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Verify Payment Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
