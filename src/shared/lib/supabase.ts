import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl
  ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey
  ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase config. Check EXPO_PUBLIC_SUPABASE_URL "
    + "and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: ({
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInContext: false,
  } as any),
});

supabase.auth.onAuthStateChange((event) => {
  if (event === "TOKEN_REFRESHED") {
    console.log("[Auth] Token refreshed successfully");
  }
  if (event === "SIGNED_OUT") {
    console.warn("[Auth] Session ended");
  }
});
