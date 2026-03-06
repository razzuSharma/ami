import Constants from "expo-constants";

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const supabaseUrl =
    Constants.expoConfig?.extra?.supabaseUrl
    ?? process.env.EXPO_PUBLIC_SUPABASE_URL
    ?? "";
  const supabaseAnonKey =
    Constants.expoConfig?.extra?.supabaseAnonKey
    ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ?? "";

  const response = await fetch(
    `${supabaseUrl}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Edge function ${functionName} failed (${response.status}) body=${errText}`);
  }

  return response.json() as Promise<T>;
}
