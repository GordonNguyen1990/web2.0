
import { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Initialize Supabase Admin Client
const supabaseUrl = process.env.SUPABASE_URL || 'https://tiwbcztyyctoprpyskly.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  const sigHeader = req.headers.get("x-nowpayments-sig");

  if (!ipnSecret) {
    console.error("CRITICAL: NOWPAYMENTS_IPN_SECRET is not set in Netlify Environment Variables.");
    return new Response("Server Configuration Error: Missing IPN Secret", { status: 500 });
  }

  if (!sigHeader) {
    console.error("Missing Signature Header");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const text = await req.text();
    const body = JSON.parse(text);

    // Verify Signature
    // Sort keys and create string
    const sortedKeys = Object.keys(body).sort();
    const jsonString = sortedKeys.map(key => `${key}=${body[key]}`).join('&');
    
    // NOWPayments actually signs the raw body sometimes, but their docs say sorted parameters string.
    // However, usually verifying the raw body with the secret is common.
    // According to NOWPayments docs: sort all the parameters in the request by name alphabetically
    // create a string...
    
    // Let's re-verify logic. Docs: 
    // "Sort all the parameters in the POST request by name alphabetically."
    // "Convert them to a string using the following format: key1=value1&key2=value2"
    // "Sign the string with your IPN Secret key using HMAC-SHA512"

    const hmac = crypto.createHmac("sha512", ipnSecret);
    hmac.update(jsonString);
    const signature = hmac.digest("hex");

    if (signature !== sigHeader) {
       console.error("Invalid Signature", { calculated: signature, received: sigHeader });
       // return new Response("Invalid Signature", { status: 403 }); 
       // Note: Sometimes there are nuances in sorting or nested objects. 
       // For now, if signature fails, we log but maybe we shouldn't proceed.
       // For safety, let's strictly return 403.
       return new Response("Invalid Signature", { status: 403 });
    }

    console.log("IPN Received:", body);

    const { payment_status, order_id, pay_amount, pay_currency } = body;

    // Only process finished payments
    if (payment_status === "finished" || payment_status === "confirmed") {
        if (!supabaseServiceKey) {
            console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
            return new Response("Server Config Error", { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get current user balance
        const { data: user, error: fetchError } = await supabase
            .from("profiles")
            .select("balance, email")
            .eq("id", order_id)
            .single();

        if (fetchError || !user) {
            console.error("User not found:", order_id);
            return new Response("User not found", { status: 404 });
        }

        // 2. Update balance
        // Note: pay_amount is the amount actually paid in crypto, but we might want the 'price_amount' (USD value)
        // NOWPayments sends 'price_amount' too.
        const depositAmount = body.price_amount || pay_amount; // Prefer USD amount
        
        const newBalance = (Number(user.balance) || 0) + Number(depositAmount);

        const { error: updateError } = await supabase
            .from("profiles")
            .update({ balance: newBalance })
            .eq("id", order_id);

        if (updateError) {
            console.error("Failed to update balance:", updateError);
            return new Response("DB Update Failed", { status: 500 });
        }

        // 3. Log transaction (Optional, if table exists)
        // We'll try to insert, if it fails (table missing), we ignore.
        /*
        await supabase.from("transactions").insert({
            user_id: order_id,
            type: 'DEPOSIT',
            amount: depositAmount,
            currency: 'USD',
            status: 'COMPLETED',
            tx_hash: body.pay_address, // or payment_id
            description: `NOWPayments: ${body.payment_id}`
        });
        */
        
        console.log(`Success: Added ${depositAmount} to user ${order_id}`);
    }

    return new Response("OK", { status: 200 });

  } catch (error: any) {
    console.error("IPN Handler Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
};
