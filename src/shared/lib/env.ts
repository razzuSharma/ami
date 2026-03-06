import Constants from "expo-constants";

type ExtraConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  companionFunctionName?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

function required(key: keyof ExtraConfig) {
  const value = extra[key];
  if (!value || typeof value !== "string") {
    throw new Error(`Missing required app config value: extra.${key}`);
  }
  const normalized = value.trim();
  const placeholderMatches =
    normalized.includes("your-project-id.supabase.co")
    || normalized.includes("your-anon-key")
    || normalized === "https://your-project-id.supabase.co";
  if (placeholderMatches) {
    throw new Error(
      `Invalid app config value for extra.${key}. Replace placeholder values in .env.local/.env.production.`,
    );
  }
  if (key === "supabaseUrl" && !/^https?:\/\//.test(normalized)) {
    throw new Error(`Invalid app config value for extra.${key}. Expected an http(s) URL.`);
  }
  return normalized;
}

export const env = {
  supabaseUrl: required("supabaseUrl"),
  supabaseAnonKey: required("supabaseAnonKey"),
  companionFunctionName: extra.companionFunctionName || "companion-chat",
};
