import { useRouter } from "expo-router";
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../helper/supabaseClient';
import { ensureUserProfile } from '../helper/userProfile';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ requiresEmailVerification: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session and validate it can be refreshed.
    if (supabase) {
      const init = async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error || !session) {
            if (error) {
              console.warn('[Auth] Failed to restore session:', error.message);
            }
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setLoading(false);
            router.replace("/(auth)/login");
            return;
          }

          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshed.session) {
            console.warn(
              '[Auth] Session expired or invalid, signing out:',
              refreshError?.message ?? 'missing refreshed session',
            );
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setLoading(false);
            router.replace("/(auth)/login");
            return;
          }

          setSession(refreshed.session);
          setUser(refreshed.session.user ?? null);
          if (refreshed.session.user) {
            ensureUserProfile(refreshed.session.user);
          }
          setLoading(false);
        } catch (initError) {
          console.warn('Failed to restore auth session:', initError);
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setLoading(false);
          router.replace("/(auth)/login");
        }
      };

      init();

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            ensureUserProfile(session.user);
          }
          setLoading(false);
        }
      );

      return () => subscription.unsubscribe();
    } else {
      // If supabase is not configured, allow access without auth
      setLoading(false);
    }
  }, [router]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Authentication not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await ensureUserProfile(data.user);
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Authentication not configured');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    await ensureUserProfile(data.user ?? null);
    return { requiresEmailVerification: !data.session };
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
