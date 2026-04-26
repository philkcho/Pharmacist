import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email/send-welcome";

// Emails allowed to have pharmacist (admin) access.
// Add new admin emails here.
const ADMIN_EMAILS = [
  "aipharmcare@gmail.com",
  "philkucho@gmail.com",
  "choym92@gmail.com",
];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/en/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Auto-assign pharmacist role for allowed admin emails
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        if (ADMIN_EMAILS.includes(user.email)) {
          // Upsert — idempotent, won't fail if role already exists
          await admin
            .from("user_roles")
            .upsert(
              { user_id: user.id, role: "pharmacist" },
              { onConflict: "user_id,role" }
            );
        }

        // Auto-link any prior email_subscribers row to this user account.
        // Reactivates the subscription if it was unsubscribed and clears
        // user_id only-null gap so digest cron can target the user later.
        await admin
          .from("email_subscribers")
          .update({
            user_id: user.id,
            unsubscribed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("email", user.email.toLowerCase())
          .is("user_id", null);

        // Welcome email — idempotent (welcome_sent_at gate). Fires once
        // per email address: first sign-in for new accounts, no-op for
        // returning users or anyone who already received one via the
        // subscribe form. mode='signup' → plain welcome with Subscribe
        // CTA (account creation does not auto-subscribe).
        const welcome = await sendWelcomeEmail({
          email: user.email,
          source: "signup",
          userId: user.id,
          mode: "signup",
        });
        if (!welcome.ok) {
          console.error("[auth/callback] welcome email failed:", welcome.reason);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/en/login?error=auth`);
}
