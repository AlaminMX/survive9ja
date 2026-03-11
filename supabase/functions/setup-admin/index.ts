import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const email = "Survive@9ja.ng";
  const password = "$uv1v39j@";
  const fullName = "Admin Survive9ja";

  // Check if user already exists by trying to sign in
  const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
  
  let userId: string;

  if (signInData?.user) {
    userId = signInData.user.id;
  } else {
    // Create the user
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400 });
    }
    userId = newUser.user.id;
  }

  // Ensure profile exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!existingProfile) {
    await supabase.from("profiles").insert({
      user_id: userId,
      full_name: fullName,
    });
  }

  // Ensure admin role
  const { data: existingRole } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .single();

  if (!existingRole) {
    await supabase.from("user_roles").insert({
      user_id: userId,
      role: "admin",
    });
  }

  return new Response(JSON.stringify({ success: true, userId }), {
    headers: { "Content-Type": "application/json" },
  });
});
