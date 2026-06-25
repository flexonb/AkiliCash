import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import ClientLoans from "./pages/ClientLoans";
import ClientSupport from "./pages/ClientSupport";
import Loans from "./pages/Loans";
import LoanDetail from "./pages/LoanDetail";
import Payments from "./pages/Payments";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";
import Install from "./pages/Install";
import AuditLog from "./pages/AuditLog";
import DrawerPage from "./pages/Drawer";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { ConfirmSaveProvider } from "@/components/ConfirmSave";
import { AuthProvider } from "@/hooks/useAuth";

const queryClient = new QueryClient();

const wrap = (el: React.ReactNode) => (
  <ProtectedRoute><AppShell>{el}</AppShell></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ConfirmSaveProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/install" element={<Install />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/" element={<Index />} />
              <Route path="/clients" element={wrap(<Clients />)} />
              <Route path="/clients/:id" element={wrap(<ClientDetail />)} />
              <Route path="/my-loans" element={wrap(<ClientLoans />)} />
              <Route path="/support" element={wrap(<ClientSupport />)} />
              <Route path="/loans" element={wrap(<Loans />)} />
              <Route path="/loans/:id" element={wrap(<LoanDetail />)} />
              <Route path="/payments" element={wrap(<Payments />)} />
              <Route path="/expenses" element={wrap(<Expenses />)} />
              <Route path="/settings" element={wrap(<Settings />)} />
              <Route path="/audit" element={wrap(<AuditLog />)} />
              <Route path="/drawer" element={wrap(<DrawerPage />)} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ConfirmSaveProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
