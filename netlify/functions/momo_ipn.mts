
import { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const {
        partnerCode,
        orderId,
        requestId,
        amount,
        orderInfo,
        orderType,
        transId,
        resultCode,
        message,
        payType,
        responseTime,
        extraData,
        signature
    } = await req.json();

    // 1. Verify Signature
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;

    if (!accessKey || !secretKey) {
        console.error("Missing MoMo Config");
        return new Response("Server Config Error", { status: 500 });
    }

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const computedSignature = crypto.createHmac("sha256", secretKey)
        .update(rawSignature)
        .digest("hex");

    if (computedSignature !== signature) {
        console.error("Invalid Signature MoMo");
        return new Response("Invalid Signature", { status: 400 });
    }

    // 2. Process Payment
    if (resultCode === 0) {
        if (!supabaseServiceKey || !supabaseUrl) {
             console.error("Missing Supabase Config");
             return new Response("Server Config Error", { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const userId = extraData; // We stored userId here

        // Check if transaction already processed
        const { data: existingTx } = await supabase
            .from('transactions')
            .select('id')
            .eq('tx_hash', String(transId)) // transId from MoMo
            .single();

        if (existingTx) {
            return new Response(JSON.stringify({ message: "Already Processed" }), { status: 200 });
        }

        // Get User
        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        if (!user) {
            console.error("User not found:", userId);
            // Still return 204 to MoMo so they don't retry
            return new Response(JSON.stringify({ message: "User not found" }), { status: 204 });
        }

        const newBalance = (Number(user.balance) || 0) + Number(amount); // MoMo amount is VND usually, but here we assume mapping 1:1 or handle conversion if needed. 
        // Note: MoMo is VND. If system is USD, we need conversion rate.
        // For now, assuming user wants VND or we treat 1 VND = 1 Unit (or assume dev handles rate).
        // Let's assume system is USD-based. 25000 VND ~ 1 USD.
        // But prompt didn't specify conversion. Let's keep it 1:1 for simplicity or warn user.
        // WARNING: MoMo sends amount in VND. System uses USD.
        // Let's divide by 25000 for simple conversion demo? 
        // Or just keep raw amount. The user prompt says "cập nhật số dư (balance)".
        // I will stick to raw amount but add a comment about currency.
        
        // Actually, let's try to be smart. If amount > 10000, it's likely VND.
        // Let's apply a conversion rate of 25,000 if amount is large?
        // No, that's risky. Let's just add the amount directly as requested.
        // Ideally we should store currency in transaction.

        const { error: balanceError } = await supabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', userId);

        if (balanceError) throw balanceError;

        await supabase.from('transactions').insert({
            user_id: userId,
            type: 'DEPOSIT',
            amount: amount,
            status: 'COMPLETED',
            tx_hash: String(transId),
            description: `MoMo Deposit: ${orderInfo}`
        });
        
        return new Response(JSON.stringify({ message: "Success" }), { status: 204 }); // 204 No Content is standard for IPN success
    } else {
        console.log("MoMo Transaction Failed:", message);
        return new Response(JSON.stringify({ message: "Transaction Failed" }), { status: 204 });
    }

  } catch (error: any) {
    console.error("MoMo IPN Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
