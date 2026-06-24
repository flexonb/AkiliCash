import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./Dashboard";
import ClientDashboard from "./ClientDashboard";
import { useAuth } from "@/hooks/useAuth";

const IndexContent = () => {
  const { isClient } = useAuth();
  return isClient ? <ClientDashboard /> : <Dashboard />;
};

const Index = () => (
  <ProtectedRoute>
    <AppShell>
      <IndexContent />
    </AppShell>
  </ProtectedRoute>
);

export default Index;
