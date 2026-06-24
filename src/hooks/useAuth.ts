import { useEffect, useState } from "react";
import { User, Session } from "firebase/auth";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "staff" | "client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, payload) => {
      const u = payload.user;
      if (!mounted) return;
      setUser(u ?? null);
      if (u) {
        setProfileLoaded(false);
        fetchProfile(u.uid || u.id);
      } else {
        setProfile(null);
        setProfileLoaded(true);
        setSessionLoading(false);
      }
    });

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!mounted) return;
      setUser(u ?? null);
      if (u) {
        fetchProfile(u.uid || u.id);
      } else {
        setProfileLoaded(true);
      }
      setSessionLoading(false);
    });

    return () => {
      mounted = false;
      if (sub?.subscription?.unsubscribe) sub.subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from("profiles").eq("id", userId).maybeSingle();
    setProfile(data);
    setProfileLoaded(true);
  }

  const userType = profile?.user_type as "company_admin" | "company_staff" | "client" | undefined;
  const isAdmin = userType === "company_admin";
  const isStaff = userType === "company_staff" || isAdmin;
  const isClient = userType === "client";
  const loading = sessionLoading || (!!user && !profileLoaded);

  return { user, profile, userType, isAdmin, isStaff, isClient, loading, refreshProfile: () => user && fetchProfile(user.uid || user.id) };
}
