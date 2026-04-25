"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface State {
  email: string | null;
  loading: boolean;
}

/**
 * Reads the current Supabase user's email on mount so subscribe forms
 * can pre-fill (and skip the input entirely) for logged-in visitors.
 *
 * Returns `email: null` when anonymous or while still loading. Callers
 * should treat `loading: true` as "do not show the form yet to avoid a
 * flash of the anonymous variant for an authenticated user."
 */
export function useCurrentUserEmail(): State {
  const [state, setState] = useState<State>({ email: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) {
          setState({ email: user?.email ?? null, loading: false });
        }
      } catch {
        if (!cancelled) setState({ email: null, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
