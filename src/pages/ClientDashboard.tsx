import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/AppCard";
import { Banknote, Wallet } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { buildSchedule, allocatePayments } from "@/lib/schedule";

interface UnifiedLoan {
  id: string;
  companyName: string;
  principal: number;
  charge: number;
  total_repayable: number;
  status: string;
  start_date: string;
  duration_months: number;
  payment_frequency: string;
  paid: number;
  balance: number;
  currencySymbol: string;
  allocations?: any[];
  nextDueAmt?: number;
  nextDueDate?: Date;
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

      // 4. Determine company details
      const companyIds = Array.from(new Set(allLoans.map((l: any) => l.company_id).filter(Boolean)));
      let companies: any[] = [];
      if (companyIds.length > 0) {
        const { data } = await api.from("settings").in("id", companyIds);
        if (data) companies = data;
      }

      const unified: UnifiedLoan[] = allLoans.map((l: any) => {
        const loanPays = validPays.filter((p: any) => p.loan_id === l.id);
        const paid = loanPays.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const company = companies.find((c: any) => c.id === l.company_id);
        
        const sched = buildSchedule({
          startDate: l.start_date,
          durationMonths: l.duration_months,
          frequency: l.payment_frequency,
          totalRepayable: Number(l.total_repayable),
        });
        const { allocations } = allocatePayments(sched.items, loanPays);
        const pending = allocations.filter(a => a.status === "pending" || a.status === "partial" || a.status === "missed");
        const nextDue = pending[0];
        
        return {
          id: l.id,
          companyName: company?.company_name || "Lending Partner",
          principal: Number(l.principal),
          charge: Number(l.charge || 0),
          total_repayable: Number(l.total_repayable),
          status: l.status,
          start_date: l.start_date,
          duration_months: l.duration_months,
          payment_frequency: l.payment_frequency,
          paid,
          balance: Math.max(0, Number(l.total_repayable) - paid),
          currencySymbol: company?.currency_symbol || "FRW",
          allocations,
          nextDueAmt: nextDue ? nextDue.amount : undefined,
          nextDueDate: nextDue ? nextDue.due : undefined,
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

        <Card className="p-6 shadow-elegant flex flex-col">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Wallet className="w-4 h-4" />
            <p className="text-sm">Total Outstanding</p>
          </div>
          <h2 className="text-3xl font-bold flex-1">FRW {totalBalance.toLocaleString()}</h2>
          <div className="mt-4">
            <Link to="/my-loans" className="text-primary text-sm font-semibold hover:underline">
              View all loans &rarr;
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
