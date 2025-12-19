
import { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { admin_id } = await req.json();

    if (!supabaseServiceKey || !supabaseUrl) {
         return new Response(JSON.stringify({ error: "Server Config Error" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify Admin
    if (admin_id) {
        const { data: adminUser } = await supabase.from('profiles').select('role').eq('id', admin_id).single();
        if (!adminUser || adminUser.role !== 'ADMIN') {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
        }
    }

    // Get Pending or Processing Transactions AND User Details
    // Supabase Foreign Key Join syntax: select('*, profiles(email, full_name)')
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*, profiles(email, full_name)')
        .eq('type', 'WITHDRAW')
        .in('status', ['PENDING', 'PROCESSING'])
        .order('created_at', { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify({ transactions }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Get Withdrawals Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
