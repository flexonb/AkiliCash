import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, profile, isAdmin, isStaff, isClient, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!profile && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  
  // Clients have a specific dashboard, prevent them from accessing staff routes.
  const clientRoutes = ["/", "/my-loans", "/support"];
  if (isClient && !clientRoutes.includes(location.pathname)) {
     return <Navigate to="/" replace />;
  }

  if (!isStaff && !isAdmin && !isClient && location.pathname !== "/onboarding") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-xl font-semibold mb-2">Access pending</h2>
          <p className="text-muted-foreground">Your account doesn't have a role yet.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
