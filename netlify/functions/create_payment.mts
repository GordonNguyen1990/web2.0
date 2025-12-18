
import { Context, Config } from "@netlify/functions";

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

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    // Note: Netlify Functions URL is dynamically set in deployed environment.
    // Locally it might be localhost:8888.
    // For IPN to work, this MUST be a public URL.
    const siteUrl = process.env.URL || "https://web2-invest-pro.netlify.app"; 

    if (!apiKey) {
      console.error("Missing NOWPAYMENTS_API_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const callbackUrl = `${siteUrl}/.netlify/functions/ipn_handler`;
    console.log("Creating payment with callback:", callbackUrl);

    // Call NOWPayments API to create fixed payment for USDT BSC
    // Using /v1/payment to get direct address
    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: "usd",
        pay_currency: "usdtbsc", // Enforce USDT BEP20
        order_id: userId,
        order_description: `Nạp tiền vào tài khoản ${userId}`,
        ipn_callback_url: callbackUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("NOWPayments Error:", data);
      return new Response(JSON.stringify({ error: "Failed to create payment", details: data }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return format expected by Frontend
    return new Response(JSON.stringify({
        address: data.pay_address,
        amount: data.pay_amount,
        currency: "usdtbsc",
        payment_id: data.payment_id,
        // Helper for frontend
        qrcode_url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data.pay_address}`,
        timeout: 1200 // 20 mins usually
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Create Payment Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
