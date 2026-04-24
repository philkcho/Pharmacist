import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

      if (user?.email && ADMIN_EMAILS.includes(user.email)) {
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        // Upsert — idempotent, won't fail if role already exists
        await admin
          .from("user_roles")
          .upsert(
            { user_id: user.id, role: "pharmacist" },
            { onConflict: "user_id,role" }
          );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/en/login?error=auth`);
}
