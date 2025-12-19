
import { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { transaction_id, admin_id, action } = await req.json(); // action: 'APPROVE' | 'REJECT'

    if (!transaction_id || !admin_id || !action) {
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
        return new Response(JSON.stringify({ error: `Transaction is ${tx.status}` }), { status: 400 });
    }

    // --- HANDLE REJECT ---
    if (action === 'REJECT') {
        // Refund balance to user
        const { data: user } = await supabase.from('profiles').select('balance').eq('id', tx.user_id).single();
        if (user) {
            const newBalance = (Number(user.balance) || 0) + Number(tx.amount);
            
            // Update Balance
            await supabase.from('profiles').update({ balance: newBalance }).eq('id', tx.user_id);
            
            // Update Transaction Status
            await supabase.from('transactions').update({ 
                status: 'FAILED', 
                description: tx.description + " (Rejected by Admin)"
            }).eq('id', transaction_id);
            
            return new Response(JSON.stringify({ status: "REJECTED", message: "Refunded to user balance" }), { status: 200 });
        } else {
             return new Response(JSON.stringify({ error: "User profile not found for refund" }), { status: 404 });
        }
    }

    // --- HANDLE APPROVE ---
    if (action === 'APPROVE') {
        // Option 1: Manual Approval (Just mark as completed)
        // Option 2: Auto Payout via NOWPayments (As currently implemented)
        
        // Let's stick to Auto Payout but handle errors gracefully
        
        const withdrawalAddress = tx.metadata?.wallet_address || (tx.description.split(': ')[1]);
        if (!withdrawalAddress) {
            // If no address found, we can't auto-pay. Maybe just mark COMPLETED manually?
            // For safety, let's fail.
            return new Response(JSON.stringify({ error: "Target wallet address not found" }), { status: 400 });
        }

        const npEmail = process.env.NOWPAYMENTS_EMAIL;
        const npPassword = process.env.NOWPAYMENTS_PASSWORD;

        // If no API creds, fallback to Manual Mark as Completed
        if (!npEmail || !npPassword) {
            await supabase.from('transactions').update({ 
                status: 'COMPLETED',
                description: tx.description + " (Manual Approval)"
            }).eq('id', transaction_id);
             return new Response(JSON.stringify({ status: "COMPLETED", message: "Marked as completed (No API Config)" }), { status: 200 });
        }

        // Call NOWPayments
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
                        currency: "usdtbsc", // Default to USDT BSC
                        amount: tx.amount,
                        ipn_callback_url: `${process.env.URL}/.netlify/functions/ipn_handler`
                    }
                ]
            })
        });

        const payoutData = await payoutRes.json();

        if (!payoutRes.ok) {
             return new Response(JSON.stringify({ error: "Payout Failed", details: payoutData }), { status: 502 });
        }

        const payoutId = payoutData.id; 

        await supabase
            .from('transactions')
            .update({ 
                status: 'PROCESSING', 
                tx_hash: payoutId,
                description: `${tx.description} (Payout ID: ${payoutId})`
            })
            .eq('id', transaction_id);

        return new Response(JSON.stringify({ status: "PROCESSING", payout_data: payoutData }), { 
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify({ error: "Invalid Action" }), { status: 400 });

  } catch (error: any) {
    console.error("Approve Withdrawal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
