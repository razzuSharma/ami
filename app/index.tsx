import { useRouter } from "expo-router";
import { useEffect } from "react";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to welcome screen - auth state logic is handled in _layout.tsx
    router.replace("/(auth)/welcome" as any);
  }, []);

  return null;
}