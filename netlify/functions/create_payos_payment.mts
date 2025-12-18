
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
    const { amount, userId } = await req.json();

    if (!amount || !userId) {
      return new Response(JSON.stringify({ error: "Missing amount or userId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!payosClientId || !payosApiKey || !payosChecksumKey || !supabaseUrl || !supabaseServiceKey) {
        return new Response(JSON.stringify({ error: "Server Config Error" }), { status: 500 });
    }

    const payos = new PayOS(payosClientId, payosApiKey, payosChecksumKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const siteUrl = process.env.URL || "https://web2-invest-pro.netlify.app"; 

    // PayOS requires orderCode to be a number (max 53 bits safe integer)
    // Using simple random number for demo, but better to use sequence or timestamp
    const orderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000)); 

    const paymentData = {
        orderCode: orderCode,
        amount: amount,
        description: `Nap tien ${userId.slice(0, 10)}`, 
        cancelUrl: `${siteUrl}`,
        returnUrl: `${siteUrl}`,
    };

    const paymentLinkData = await payos.createPaymentLink(paymentData);

    // Save Pending Transaction to DB
    await supabase.from('transactions').insert({
        user_id: userId,
        type: 'DEPOSIT',
        amount: amount,
        status: 'PENDING',
        tx_hash: String(orderCode), // Use orderCode as tx_hash for mapping
        description: `PayOS Deposit: ${orderCode}`,
        metadata: { provider: 'PAYOS' }
    });

    return new Response(JSON.stringify({ 
        checkoutUrl: paymentLinkData.checkoutUrl,
        orderCode: orderCode,
        amount: amount
    }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Create PayOS Payment Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
