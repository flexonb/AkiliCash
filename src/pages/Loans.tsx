import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/AppCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useSettings, formatMoney } from "@/hooks/useSettings";
import { LoanForm } from "@/components/LoanForm";
import { cn } from "@/lib/utils";

import { buildSchedule, allocatePayments } from "@/lib/schedule";

const FILTERS = ["all", "pending", "approved", "active", "overdue", "completed", "rejected", "defaulted"] as const;
type Filter = typeof FILTERS[number];

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "completed") return "secondary";
  if (s === "defaulted" || s === "rejected") return "destructive";
  if (s === "pending") return "outline";
  return "default";
};

export default function Loans() {
  const { settings } = useSettings();
  const [rows, setRows] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [openNew, setOpenNew] = useState(false);

  const load = async () => {
    const [{ data: loans }, { data: pays }] = await Promise.all([
      api
        .from("loans")
        .select("id, principal, charge, total_repayable, interest_rate, duration_months, status, start_date, created_at, client_id, payment_frequency, clients(full_name, phone)")
        .order("created_at", { ascending: false }),
      api.from("payments").select("id, amount, loan_id, paid_at").is("voided_at", null),
    ]);
    setRows(loans ?? []);
    setPayments(pays ?? []);
  };

  useEffect(() => { load(); }, []);

  const paymentsByLoan = useMemo(() => {
    const m = new Map<string, any[]>();
    payments.forEach((p) => {
      const list = m.get(p.loan_id) ?? [];
      list.push(p);
      m.set(p.loan_id, list);
    });
    return m;
  }, [payments]);

  const overdueIds = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((l) => {
      if (!["active", "approved"].includes(l.status)) return;
      try {
        const sched = buildSchedule({
          startDate: l.start_date,
          durationMonths: l.duration_months,
          frequency: (l.payment_frequency ?? "monthly"),
          gracePeriodDays: 0,
          totalRepayable: Number(l.total_repayable),
        });
        const { allocations } = allocatePayments(sched.items, paymentsByLoan.get(l.id) ?? []);
        if (allocations.some((a) => a.status === "missed")) set.add(l.id);
      } catch { /* ignore */ }
    });
    return set;
  }, [rows, paymentsByLoan]);

  const summary = useMemo(() => {
    const paidByLoan = new Map<string, number>();
    payments.forEach((p) => paidByLoan.set(p.loan_id, (paidByLoan.get(p.loan_id) ?? 0) + Number(p.amount)));
    let disbursed = 0, repaid = 0, outstanding = 0, pending = 0, fees = 0;
    rows.forEach((l) => {
      const paid = paidByLoan.get(l.id) ?? 0;
      const charge = Math.max(0, Number(l.charge ?? 0));
      if (l.status === "active" || l.status === "approved" || l.status === "completed" || l.status === "defaulted") {
        disbursed += Math.max(0, Number(l.principal) - charge);
        fees += charge;
        repaid += paid;
      }
      if (l.status === "active" || l.status === "approved" || l.status === "defaulted") {
        outstanding += Math.max(0, Number(l.total_repayable) - paid);
      }
      if (l.status === "pending") pending += Number(l.principal);
    });
    return { disbursed, repaid, outstanding, pending, fees };
  }, [rows, payments]);

  const filtered =
    filter === "all"
      ? rows
      : filter === "active"
        ? rows.filter((l) => l.status === "active" || l.status === "approved")
        : filter === "overdue"
          ? rows.filter((l) => overdueIds.has(l.id))
          : rows.filter((l) => l.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Cash-out</h1>
          <p className="text-muted-foreground">Staff request loans on behalf of clients · admin approves before disbursement</p>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="w-4 h-4 mr-1" /> New loan request</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Disbursed</p><p className="font-bold mt-1">{formatMoney(summary.disbursed, settings)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Fees</p><p className="font-bold mt-1 text-success">{formatMoney(summary.fees, settings)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Repaid</p><p className="font-bold mt-1 text-success">{formatMoney(summary.repaid, settings)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="font-bold mt-1">{formatMoney(summary.outstanding, settings)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Pending requests</p><p className="font-bold mt-1">{formatMoney(summary.pending, settings)}</p></Card>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors",
              filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.map((l) => (
          <Link key={l.id} to={`/loans/${l.id}`}>
            <Card className="p-4 hover:shadow-elegant transition-shadow">
              <div className="flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{l.clients?.full_name ?? "—"}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {formatMoney(l.principal, settings)} · {l.interest_rate}% · {l.duration_months}mo
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                  {overdueIds.has(l.id) && (
                    <Badge variant="destructive" className="text-[10px]">Missed</Badge>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            {filter === "all" ? "No loans yet." : `No ${filter} loans.`}
          </Card>
        )}
      </div>

      <LoanForm open={openNew} onOpenChange={setOpenNew} pickClient onCreated={load} />
    </div>
  );
}
