import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/AppCard";
import { Banknote, TrendingUp, AlertTriangle, Wallet } from "lucide-react";
import { formatMoney } from "@/hooks/useSettings";
import { PageSkeleton } from "@/components/PageSkeleton";

interface UnifiedLoan {
  id: string;
  companyName: string;
  principal: number;
  charge: number;
  total_repayable: number;
  status: string;
  start_date: string;
  duration_months: number;
  paid: number;
  balance: number;
  currencySymbol: string;
}

export default function ClientDashboard() {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<UnifiedLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.national_id) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [profile]);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Find all client records linked to this national ID
      const { data: clients } = await api.from("clients").eq("national_id", profile.national_id);
      if (!clients?.length) {
        setLoans([]);
        return;
      }
      const clientIds = clients.map((c: any) => c.id);

      // 2. Fetch all loans for these client IDs
      const { data: allLoans } = await api.from("loans").in("client_id", clientIds);
      if (!allLoans?.length) {
        setLoans([]);
        return;
      }

      // 3. Fetch all payments for these loans
      const loanIds = allLoans.map((l: any) => l.id);
      const { data: pays } = await api.from("payments").in("loan_id", loanIds);
      const validPays = (pays || []).filter((p: any) => !p.voided_at);

      // 4. Determine company details (since we added multi-tenancy, loans/clients should map to companies eventually. For now, use basic RWF)
      // Since we don't have company_id deeply linked in old schema, we'll mock it or use RWF.

      const unified: UnifiedLoan[] = allLoans.map((l: any) => {
        const loanPays = validPays.filter((p: any) => p.loan_id === l.id);
        const paid = loanPays.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        return {
          id: l.id,
          companyName: "Lending Partner", // Placeholder for company name
          principal: Number(l.principal),
          charge: Number(l.charge || 0),
          total_repayable: Number(l.total_repayable),
          status: l.status,
          start_date: l.start_date,
          duration_months: l.duration_months,
          paid,
          balance: Math.max(0, Number(l.total_repayable) - paid),
          currencySymbol: "FRW" // Default
        };
      });

      // Sort by active first
      unified.sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return +new Date(b.start_date) - +new Date(a.start_date);
      });

      setLoans(unified);
    } catch (e) {
      console.error("Error fetching client dashboard:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <PageSkeleton />;

  const activeLoans = loans.filter(l => l.status === "active" || l.status === "approved");
  const totalBalance = activeLoans.reduce((sum, l) => sum + l.balance, 0);

  // AkiliScore calculation (Simplified CRB logic)
  let score = 0;
  let scoreText = "Newbie";
  let scoreColor = "text-muted-foreground";

  if (loans.length > 0) {
    const completed = loans.filter(l => l.status === "completed").length;
    const defaulted = loans.filter(l => l.status === "defaulted").length;
    
    score = 500; // Base score
    score += completed * 50;
    score -= defaulted * 150;
    
    if (defaulted > 0) {
      scoreText = "High Risk";
      scoreColor = "text-destructive";
    } else if (completed > 0 && activeLoans.length > 0) {
      scoreText = "Excellent";
      scoreColor = "text-success";
      score = Math.max(700, score);
    } else if (completed > 0) {
      scoreText = "Good";
      scoreColor = "text-primary";
    } else {
      scoreText = "Fair";
      scoreColor = "text-yellow-600";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Borrower Profile</h1>
        <p className="text-muted-foreground">Unified view of your loans across all lending companies.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-6 shadow-elegant flex flex-col justify-center border-t-4 border-t-primary">
          <p className="text-sm text-muted-foreground">AkiliScore</p>
          <div className="flex items-end gap-2 mt-2">
            <h2 className="text-4xl font-black">{loans.length > 0 ? score : "---"}</h2>
            <span className={`font-semibold mb-1 ${scoreColor}`}>{scoreText}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Based on your National ID history.</p>
        </Card>
        
        <Card className="p-6 shadow-elegant">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Banknote className="w-4 h-4" />
            <p className="text-sm">Active Loans</p>
          </div>
          <h2 className="text-3xl font-bold">{activeLoans.length}</h2>
        </Card>

        <Card className="p-6 shadow-elegant">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Wallet className="w-4 h-4" />
            <p className="text-sm">Total Outstanding</p>
          </div>
          <h2 className="text-3xl font-bold">FRW {totalBalance.toLocaleString()}</h2>
        </Card>
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4">Your Loans</h2>
      {loans.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <Wallet className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No loans found linked to your National ID.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {loans.map(loan => (
            <Card key={loan.id} className="p-6 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{loan.companyName}</p>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold">{loan.currencySymbol} {loan.principal.toLocaleString()}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    loan.status === 'completed' ? 'bg-success/10 text-success' : 
                    loan.status === 'defaulted' ? 'bg-destructive/10 text-destructive' : 
                    'bg-primary/10 text-primary'
                  }`}>
                    {loan.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Started {new Date(loan.start_date).toLocaleDateString()} · {loan.duration_months} months
                </p>
              </div>

              <div className="text-left sm:text-right w-full sm:w-auto p-4 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Outstanding Balance</p>
                <p className="font-semibold text-lg">{loan.currencySymbol} {loan.balance.toLocaleString()}</p>
                {loan.paid > 0 && <p className="text-xs text-success mt-1">Paid {loan.currencySymbol} {loan.paid.toLocaleString()}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
