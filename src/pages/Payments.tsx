import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { loadTableOffline } from "@/lib/offline/sb";
import { Card } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Phone, Plus, Search } from "lucide-react";
import { useSettings, formatMoney } from "@/hooks/useSettings";
import { buildSchedule, type Frequency } from "@/lib/schedule";
import { PaymentForm } from "@/components/PaymentForm";
import { ClientPicker } from "@/components/ClientPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/PageSkeleton";

type Loan = {
  id: string;
  client_id: string;
  principal: number;
  total_repayable: number;
  start_date: string;
  duration_months: number;
  payment_frequency: Frequency;
  grace_period_days?: number;
  status: string;
  clients?: { id: string; full_name: string; phone: string } | null;
};

type Payment = {
  id: string;
  amount: number;
  paid_at: string;
  method: string | null;
  reference: string | null;
  loan_id: string;
  loans?: { client_id: string; clients?: { full_name: string } | null } | null;
};

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

import { formatTel, dialPhone } from "@/lib/dial";
import { useAuth } from "@/hooks/useAuth";

export default function Payments() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [paymentsByLoan, setPaymentsByLoan] = useState<Record<string, Payment[]>>({});
  const [recent, setRecent] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [picker, setPicker] = useState(false);
  const [active, setActive] = useState<{ loanId: string; balance: number; suggested: number } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      // Offline-first reads — fall back to local cache when there is no network.
      const [allLoans, clients, allPays] = await Promise.all([
        loadTableOffline<any>("loans", "id, client_id, principal, total_repayable, start_date, duration_months, payment_frequency, status", profile?.company_id),
        loadTableOffline<any>("clients", "id, full_name, phone", profile?.company_id),
        loadTableOffline<any>("payments", "id, amount, paid_at, method, reference, loan_id, voided_at, created_by", profile?.company_id),
      ]);
      const clientById = new Map<string, any>(clients.map((c: any) => [c.id, c]));
      const list: Loan[] = allLoans
        .filter((l: any) => l.status === "active" || l.status === "approved")
        .map((l: any) => ({
          ...l,
          clients: clientById.get(l.client_id)
            ? { id: l.client_id, full_name: clientById.get(l.client_id).full_name, phone: clientById.get(l.client_id).phone }
            : null,
        })) as any;
      setLoans(list);

      const livePays = (allPays as any[]).filter((p) => !p.voided_at);
      const map: Record<string, Payment[]> = {};
      livePays.forEach((p: any) => { (map[p.loan_id] ||= []).push(p as Payment); });
      setPaymentsByLoan(map);

      const sevenAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const loanById = new Map<string, any>(allLoans.map((l: any) => [l.id, l]));
      const rec: Payment[] = livePays
        .filter((p: any) => +new Date(p.paid_at) >= sevenAgo)
        .sort((a: any, b: any) => +new Date(b.paid_at) - +new Date(a.paid_at))
        .map((p: any) => {
          const loan = loanById.get(p.loan_id);
          const c = loan ? clientById.get(loan.client_id) : null;
          return { ...p, loans: loan ? { client_id: loan.client_id, clients: c ? { id: c.id, full_name: c.full_name } : null } : null } as Payment;
        });
      setRecent(rec);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.company_id) {
      load();
    }
  }, [profile?.company_id]);

  const today = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  // Compute per-loan due info
  const enriched = useMemo(() => loans.map((l) => {
    const pays = paymentsByLoan[l.id] ?? [];
    const totalPaid = pays.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Math.max(0, Number(l.total_repayable) - totalPaid);
    const sched = buildSchedule({
      startDate: l.start_date,
      durationMonths: l.duration_months,
      frequency: l.payment_frequency,
      gracePeriodDays: l.grace_period_days ?? 0,
      totalRepayable: Number(l.total_repayable),
    });
    let dueAmount = 0;
    let nextDue: Date | null = null;
    let overdue = false;
    let cum = 0;
    for (const it of sched.items) {
      cum += it.amount;
      if (it.due <= todayEnd) {
        if (totalPaid < cum) {
          dueAmount = cum - totalPaid;
          nextDue = it.due;
          overdue = it.due < today;
          break;
        }
      } else {
        if (!nextDue) { nextDue = it.due; dueAmount = Math.max(0, cum - totalPaid); }
        break;
      }
    }
    const isDueToday = !!nextDue && nextDue <= todayEnd && balance > 0;
    const lastPayment = pays.sort((a, b) => +new Date(b.paid_at) - +new Date(a.paid_at))[0];
    return { loan: l, totalPaid, balance, dueAmount: Math.min(dueAmount, balance), nextDue, isDueToday, overdue, lastPayment };
  }), [loans, paymentsByLoan]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((e) => e.balance > 0)
      .filter((e) => showAll || e.isDueToday)
      .filter((e) => !q || e.loan.clients?.full_name.toLowerCase().includes(q) || e.loan.clients?.phone?.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return (+(a.nextDue ?? 0)) - (+(b.nextDue ?? 0));
      });
  }, [enriched, search, showAll]);

  const todayPays = recent.filter((p) => new Date(p.paid_at) >= today);
  const collectedToday = todayPays.reduce((s, p) => s + Number(p.amount), 0);
  const expectedToday = enriched.filter((e) => e.isDueToday).reduce((s, e) => s + e.dueAmount, 0);
  const clientsDue = enriched.filter((e) => e.isDueToday).length;
  const outstanding = enriched.reduce((s, e) => s + e.balance, 0);

  async function openForClient(clientId: string) {
    setPicker(false);
    // pick the active loan for this client with largest balance
    const candidate = enriched.filter((e) => e.loan.client_id === clientId && e.balance > 0)
      .sort((a, b) => b.balance - a.balance)[0];
    if (!candidate) {
      const { toast } = await import("sonner");
      toast.error("This client has no active loan with a balance");
      return;
    }
    setActive({ loanId: candidate.loan.id, balance: candidate.balance, suggested: candidate.dueAmount || 0 });
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Cash-in</h1>
          <p className="text-muted-foreground">Daily reimbursements from clients</p>
        </div>
        <Button onClick={() => setPicker(true)}><Plus className="w-4 h-4 mr-1" /> Record payment</Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Collected today</p><p className="text-lg font-bold text-success">{formatMoney(collectedToday, settings)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Expected today</p><p className="text-lg font-bold">{formatMoney(expectedToday, settings)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Clients due</p><p className="text-lg font-bold">{clientsDue}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-lg font-bold">{formatMoney(outstanding, settings)}</p></Card>
      </div>

      {/* Due today */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-xl font-semibold">{showAll ? "All active loans" : "Due today"}</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client…" className="pl-8 w-48" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show due only" : "Show all active"}
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          {filtered.map((e) => (
            <Card key={e.loan.id} className="p-3">
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div className="min-w-0">
                  {e.loan.clients?.id ? (
                    <Link to={`/clients/${e.loan.clients.id}`} className="font-medium hover:underline">
                      {e.loan.clients.full_name}
                    </Link>
                  ) : (
                    <span className="font-medium">{e.loan.clients?.full_name ?? "—"}</span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Balance {formatMoney(e.balance, settings)}
                    {e.lastPayment && ` · Last paid ${new Date(e.lastPayment.paid_at).toLocaleDateString()}`}
                  </p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {e.overdue && <Badge variant="destructive">Overdue</Badge>}
                    {!e.overdue && e.isDueToday && <Badge>Due today</Badge>}
                    {!e.isDueToday && <Badge variant="secondary">Next {e.nextDue?.toLocaleDateString()}</Badge>}
                    <span className="text-xs text-muted-foreground">Installment {formatMoney(e.dueAmount || 0, settings)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {e.loan.clients?.phone && (() => {
                    const tel = formatTel(e.loan.clients.phone);
                    return (
                      <button
                        type="button"
                        title={`Call ${tel}`}
                        aria-label={`Call ${e.loan.clients.full_name} at ${tel}`}
                        onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); dialPhone(e.loan.clients!.phone, e.loan.clients!.full_name); }}
                        className="touch-manipulation inline-flex items-center justify-center h-10 w-10 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground active:scale-95"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    );
                  })()}
                  <Button size="sm" onClick={() => setActive({ loanId: e.loan.id, balance: e.balance, suggested: e.dueAmount || 0 })}>
                    Record
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              {showAll ? "No active loans." : "Nothing due today. 🎉"}
            </Card>
          )}
        </div>
      </section>

      {/* Today's collections */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Today's collections</h2>
          <span className="text-sm text-muted-foreground">{todayPays.length} · {formatMoney(collectedToday, settings)}</span>
        </div>
        <div className="grid gap-2">
          {todayPays.map((p) => (
            <Link key={p.id} to={`/loans/${p.loan_id}`}>
              <Card className="p-3 hover:shadow-elegant transition-shadow flex justify-between items-center">
                <div>
                  <p className="font-medium">{formatMoney(p.amount, settings)}</p>
                  <p className="text-xs text-muted-foreground">{p.loans?.clients?.full_name} · {new Date(p.paid_at).toLocaleTimeString()}</p>
                </div>
                <span className="text-xs text-muted-foreground">{p.method}</span>
              </Card>
            </Link>
          ))}
          {todayPays.length === 0 && <p className="text-sm text-muted-foreground">No payments yet today.</p>}
        </div>
      </section>

      {/* Last 7 days */}
      <section className="space-y-3">
        {(() => {
          const last7 = recent.filter((p) => new Date(p.paid_at) < today);
          const collected7 = last7.reduce((s, p) => s + Number(p.amount), 0);
          return (
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Last 7 days</h2>
              <span className="text-sm text-muted-foreground">{last7.length} · {formatMoney(collected7, settings)}</span>
            </div>
          );
        })()}
        <div className="grid gap-2">
          {recent.filter((p) => new Date(p.paid_at) < today).map((p) => (
            <Link key={p.id} to={`/loans/${p.loan_id}`}>
              <Card className="p-3 hover:shadow-elegant transition-shadow flex justify-between items-center">
                <div>
                  <p className="font-medium">{formatMoney(p.amount, settings)}</p>
                  <p className="text-xs text-muted-foreground">{p.loans?.clients?.full_name} · {new Date(p.paid_at).toLocaleString()}</p>
                </div>
                <span className="text-xs text-muted-foreground">{p.method}</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Select client</DialogTitle></DialogHeader>
          <ClientPicker value={null} onChange={(id) => openForClient(id)} />
        </DialogContent>
      </Dialog>

      {active && (
        <PaymentForm
          open={!!active}
          onOpenChange={(v) => { if (!v) setActive(null); }}
          loanId={active.loanId}
          maxAmount={active.balance}
          defaultAmount={active.suggested}
          onCreated={load}
        />
      )}
    </div>
  );
}
