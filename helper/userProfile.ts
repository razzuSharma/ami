import { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export async function ensureUserProfile(user: User | null) {
  if (!user) return;

  const fallbackName = user.email?.split("@")[0] ?? null;
  const { error } = await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: fallbackName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.warn("Failed to ensure user profile row:", error.message);
  }
}
