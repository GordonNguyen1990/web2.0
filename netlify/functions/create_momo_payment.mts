
import { Context } from "@netlify/functions";
import crypto from "crypto";
import axios from "axios";

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

    // Config
    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const endpoint = process.env.MOMO_ENDPOINT || "https://test-payment.momo.vn/v2/gateway/api/create";
    const siteUrl = process.env.URL || "https://web2-invest-pro.netlify.app"; // Adjust for local/prod

    if (!partnerCode || !accessKey || !secretKey) {
        return new Response(JSON.stringify({ error: "Server Config Error: Missing MoMo Credentials" }), { status: 500 });
    }

    const requestId = partnerCode + new Date().getTime();
    const orderId = requestId;
    const orderInfo = `Nap tien cho user ${userId}`;
    const redirectUrl = `${siteUrl}`; // Quay ve trang chu sau khi thanh toan
    const ipnUrl = `${siteUrl}/.netlify/functions/momo_ipn`;
    const requestType = "captureWallet";
    const extraData = userId; // Store userId in extraData to retrieve in IPN

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const signature = crypto.createHmac("sha256", secretKey)
        .update(rawSignature)
        .digest("hex");

    const requestBody = {
        partnerCode,
        accessKey,
        requestId,
        amount,
        orderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        extraData,
        requestType,
        signature,
        lang: 'vi'
    };

    const response = await axios.post(endpoint, requestBody);
    const data = response.data;

    if (data.resultCode !== 0) {
        return new Response(JSON.stringify({ error: "MoMo API Error", details: data }), { status: 500 });
    }

    return new Response(JSON.stringify({ payUrl: data.payUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Create MoMo Payment Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
