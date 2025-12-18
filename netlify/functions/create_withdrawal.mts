
import { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin Client
const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { user_id, amount, wallet_address } = await req.json();

    if (!user_id || !amount || !wallet_address) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    if (!supabaseServiceKey || !supabaseUrl) {
         return new Response(JSON.stringify({ error: "Server Config Error" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Check User Balance
    const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user_id)
        .single();

    if (userError || !user) {
        return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    if (user.balance < amount) {
        return new Response(JSON.stringify({ error: "Insufficient balance" }), { status: 400 });
    }

    // 2. Deduct Balance immediately (Lock funds)
    const newBalance = user.balance - amount;
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', user_id);

    if (updateError) {
        throw updateError;
    }

    // 3. Create Pending Transaction
    const { error: txError } = await supabase
        .from('transactions')
        .insert({
            user_id: user_id,
            type: 'WITHDRAW',
            amount: amount,
            status: 'PENDING',
            description: `Rút về ví: ${wallet_address}`,
            tx_hash: `REQ_${Date.now()}_${user_id.slice(0,4)}`, // Temporary ID
            metadata: { wallet_address: wallet_address } // Store target wallet here or in description
        });

    if (txError) {
        // Rollback balance if tx fails (Basic compensation)
        await supabase.from('profiles').update({ balance: user.balance }).eq('id', user_id);
        throw txError;
    }

    return new Response(JSON.stringify({ status: "SUCCESS", new_balance: newBalance }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Create Withdrawal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
