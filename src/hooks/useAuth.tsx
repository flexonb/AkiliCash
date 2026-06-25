import { useEffect, useState, createContext, useContext } from "react";
import { User } from "firebase/auth";
import { api } from "@/lib/api";

export type AppRole = "admin" | "staff" | "client";

interface AuthContextType {
  user: User | null;
  profile: any | null;
  userType: "company_admin" | "company_staff" | "client" | undefined;
  isAdmin: boolean;
  isStaff: boolean;
  isClient: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = api.auth.onAuthStateChange((_event: any, payload: any) => {
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

    return () => {
      mounted = false;
      if (sub?.subscription?.unsubscribe) sub.subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await api.from("profiles").eq("id", userId).maybeSingle();
    setProfile(data);
    setProfileLoaded(true);
    setSessionLoading(false);
  }

  const userType = profile?.user_type as "company_admin" | "company_staff" | "client" | undefined;
  const isAdmin = userType === "company_admin";
  const isStaff = userType === "company_staff" || isAdmin;
  const isClient = userType === "client";
  const loading = sessionLoading || (!!user && !profileLoaded);

  return (
    <AuthContext.Provider value={{ user, profile, userType, isAdmin, isStaff, isClient, loading, refreshProfile: async () => { if(user) await fetchProfile(user.uid || user.id); } }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
