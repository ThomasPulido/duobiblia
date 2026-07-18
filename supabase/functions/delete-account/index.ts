import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const body = await request.json().catch(() => ({}));
  if (body.confirmation !== "DELETE_DUOBIBLIA_ACCOUNT") {
    return new Response("Confirmation required", { status: 400, headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const user = userData.user;
  if (user.email) {
    await admin.from("bold_payments")
      .update({ payer_email: `deleted+${user.id}@invalid.duobiblia`, payload: {} })
      .eq("payer_email", user.email.toLowerCase());
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return new Response("Account deletion failed", { status: 500, headers: corsHeaders });
  return Response.json({ deleted: true }, { headers: corsHeaders });
});
