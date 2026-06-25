import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/AppCard";
import { Banknote, Wallet } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { buildSchedule, allocatePayments } from "@/lib/schedule";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

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

export default function ClientLoans() {
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
      const { data: clients } = await api.from("clients").eq("national_id", profile.national_id);
      if (!clients?.length) {
        setLoans([]);
        return;
      }
      const clientIds = clients.map((c: any) => c.id);

      const { data: allLoans } = await api.from("loans").in("client_id", clientIds);
      if (!allLoans?.length) {
        setLoans([]);
        return;
      }

      const loanIds = allLoans.map((l: any) => l.id);
      const { data: pays } = await api.from("payments").in("loan_id", loanIds);
      const validPays = (pays || []).filter((p: any) => !p.voided_at);

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

      unified.sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return +new Date(b.start_date) - +new Date(a.start_date);
      });

      setLoans(unified);
    } catch (e) {
      console.error("Error fetching client loans:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Loans</h1>
        <p className="text-muted-foreground">Manage and track your active loans.</p>
      </div>

      {loans.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <Wallet className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No loans found linked to your National ID.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {loans.map(loan => (
            <Card key={loan.id} className="p-0 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
                <div className="flex-1">
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Lending Partner</p>
                    <h4 className="text-xl font-bold text-foreground">{loan.companyName}</h4>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-medium">{loan.currencySymbol} {loan.principal.toLocaleString()}</h3>
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
                  
                  {loan.status === "active" && loan.nextDueDate && loan.nextDueAmt !== undefined && (
                    <div className="mt-4 p-3 bg-primary/5 rounded-md border border-primary/10 inline-block">
                      <p className="text-xs text-primary font-medium mb-0.5">Next Payment Due</p>
                      <p className="font-semibold text-lg">{loan.currencySymbol} {loan.nextDueAmt.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">by {loan.nextDueDate.toLocaleDateString()}</span></p>
                    </div>
                  )}
                </div>

                <div className="w-full sm:w-72 space-y-4">
                  <div className="text-left sm:text-right p-4 bg-muted/30 rounded-xl border border-muted">
                    <p className="text-xs text-muted-foreground mb-1">Outstanding Balance</p>
                    <p className="font-bold text-2xl text-foreground">{loan.currencySymbol} {loan.balance.toLocaleString()}</p>
                  </div>
                  
                  <div className="space-y-1.5 px-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Repayment Progress</span>
                      <span className="font-bold text-primary">{Math.round((loan.paid / loan.total_repayable) * 100)}%</span>
                    </div>
                    <Progress value={(loan.paid / loan.total_repayable) * 100} className="h-2 bg-muted/50" />
                  </div>
                  
                  {loan.allocations && loan.allocations.length > 0 && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="text-sm text-primary hover:underline font-medium w-full text-center sm:text-right pt-2">
                          View Repayment Schedule
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Repayment Schedule</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 mt-4">
                          {loan.allocations.map((a, i) => (
                            <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                              <div>
                                <p className="font-medium">#{a.index}</p>
                                <p className="text-xs text-muted-foreground">{a.due.toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{loan.currencySymbol} {a.amount.toLocaleString()}</p>
                                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  a.status === 'paid' ? 'bg-success/10 text-success' :
                                  a.status === 'paid_late' ? 'bg-success/10 text-success' :
                                  a.status === 'partial' ? 'bg-yellow-500/10 text-yellow-600' :
                                  a.status === 'missed' ? 'bg-destructive/10 text-destructive' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {a.status.replace("_", " ")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
              
              <div className="border-t bg-muted/20 p-4 flex flex-col sm:flex-row gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 py-3 px-4 rounded-lg shadow-sm text-center font-semibold transition-colors text-sm">
                      Make a Payment
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Pay {loan.companyName}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 text-sm text-muted-foreground">
                      <p>You can make payments using Mobile Money or directly at the branch.</p>
                      <div className="bg-muted p-4 rounded-lg space-y-2">
                        <p className="font-semibold text-foreground">Mobile Money (MTN/Airtel)</p>
                        <p>1. Dial *182*8*1#</p>
                        <p>2. Enter merchant code: <strong className="text-foreground">000000</strong></p>
                        <p>3. Enter amount and your PIN to confirm.</p>
                      </div>
                      <p>Please keep the confirmation message. Your balance will update within a few minutes.</p>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 py-3 px-4 rounded-lg shadow-sm text-center font-semibold transition-colors text-sm">
                      Need Help?
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Contact {loan.companyName}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 text-sm text-muted-foreground">
                      <p>If you are facing difficulties making a payment or have questions about your loan, please reach out directly.</p>
                      <div className="space-y-2">
                        <p><strong>Call Toll-Free:</strong> 1122</p>
                        <p><strong>Email:</strong> support@akili.rw</p>
                        <p><strong>Branch:</strong> Contact the local branch representative</p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
