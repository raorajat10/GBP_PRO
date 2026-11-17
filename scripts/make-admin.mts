/**
 * One-time bootstrap: make someone an admin (creates the account if needed).
 *   npm run make-admin -- you@company.com "Your Name"
 * Uses SUPABASE_SECRET_KEY from .env.local. After that, admins add people from /team.
 */
import { createClient } from "@supabase/supabase-js";

const [emailArg, fullName] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!email || !email.includes("@")) {
  console.error('Usage: npm run make-admin -- you@company.com "Your Name"');
  process.exit(1);
}
if (!url || !secretKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");
  process.exit(1);
}

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const created = await admin.auth.admin.createUser({
  email,
  email_confirm: true,
  app_metadata: { role: "admin" },
  user_metadata: fullName ? { full_name: fullName } : {},
});

let userId = created.data.user?.id;
if (created.error) {
  // Probably exists already — find them and promote.
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (error || !profile) {
    console.error(`Could not create or find ${email}: ${created.error.message}`);
    process.exit(1);
  }
  userId = profile.id;
  await admin.auth.admin.updateUserById(profile.id, { app_metadata: { role: "admin" } });
}

const update: { role: "admin"; full_name?: string } = { role: "admin" };
if (fullName) update.full_name = fullName;
const { error: updateError } = await admin.from("profiles").update(update).eq("id", userId!);
if (updateError) {
  console.error(`Account exists but role update failed: ${updateError.message}`);
  process.exit(1);
}

console.log(`✓ ${email} is an admin. Sign in at /login with an email code.`);
