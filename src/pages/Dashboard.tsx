import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Banknote, Users, AlertTriangle, TrendingUp, Wallet, ArrowDownCircle, Receipt, Lock, Unlock } from "lucide-react";
import { api } from "@/lib/api";
import { loadTableOffline } from "@/lib/offline/sb";
import { CloseDrawerDialog } from "@/components/CloseDrawerDialog";
import { OpenDrawerDialog } from "@/components/OpenDrawerDialog";
import { useSettings, formatMoney } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate } from "react-router-dom";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { CashFlowChart } from "@/components/dashboard/charts/CashFlowChart";
import { LoanStatusChart } from "@/components/dashboard/charts/LoanStatusChart";
import { RepaymentChart } from "@/components/dashboard/charts/RepaymentChart";
import { ProfitChart } from "@/components/dashboard/charts/ProfitChart";
import type { DateRange, ExpenseRow, LoanRow, Mode, PaymentRow } from "@/lib/analytics";

function defaultRange(): DateRange {
  const to = new Date(); to.setHours(23, 59, 59, 999);
  const from = new Date(); from.setDate(1); from.setHours(0, 0, 0, 0);
  return { from, to };
}

interface OpenSession {
  id: string;
  opened_at: string;
  opening_balance: number;
}

export default function Dashboard() {
  const { settings } = useSettings();
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ activeLoans: 0, outstanding: 0, overdue: 0, dayCollected: 0, monthCollected: 0, clients: 0, dayCashOut: 0, dayExpenses: 0, dayFees: 0, drawerBalance: 0 });
  const [closeOpen, setCloseOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [session, setSession] = useState<OpenSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [range, setRange] = useState<DateRange>(defaultRange());
  const [preset, setPreset] = useState<"today" | "week" | "month" | "custom">("month");
  const [mode, setMode] = useState<Mode>("amount");

  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRow[]>([]);
  const [rangePayments, setRangePayments] = useState<PaymentRow[]>([]);
  const [rangeExpenses, setRangeExpenses] = useState<ExpenseRow[]>([]);
  const [dailyDisbursements, setDailyDisbursements] = useState<Array<{ id: string; client: string; principal: number; charge: number; net: number; at: Date }>>([]);

  // Find current open session for THIS user — offline-tolerant
  useEffect(() => {
    if (!user) return;
    (async () => {
      let active: OpenSession | null = null;
      if (typeof navigator === "undefined" || navigator.onLine) {
        try {
          const { data } = await api
            .from("drawer_sessions")
            .select("id, opened_at, opening_balance, opened_by")
            .eq("opened_by", user.id)
            .is("closed_at", null)
            .order("opened_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) active = { id: data.id, opened_at: data.opened_at, opening_balance: Number(data.opening_balance) };
        } catch { /* offline fallback below */ }
      }
      if (!active) {
        const cached = await loadTableOffline<any>("drawer_sessions", "*", profile?.company_id);
        const open = cached
          .filter((s) => !s.closed_at && s.opened_by === user.id)
          .sort((a, b) => +new Date(b.opened_at) - +new Date(a.opened_at))[0];
        if (open) active = { id: open.id, opened_at: open.opened_at, opening_balance: Number(open.opening_balance) };
      }
      if (active) {
        setSession(active);
        setOpenOpen(false);
      } else {
        setSession(null);
        if (typeof navigator === "undefined" || navigator.onLine) setOpenOpen(true);
      }
      setSessionChecked(true);
    })();
  }, [user, profile?.company_id, refreshKey]);

  // KPI cards — offline-first
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [clientsAll, loansAll, paysAll, expAll] = await Promise.all([
        loadTableOffline<any>("clients", "id", profile?.company_id),
        loadTableOffline<any>("loans", "id, client_id, principal, charge, total_repayable, status, start_date, disbursed_at, duration_months, payment_frequency, created_by", profile?.company_id),
        loadTableOffline<any>("payments", "id, amount, paid_at, loan_id, voided_at, created_by", profile?.company_id),
        loadTableOffline<any>("expenses", "id, amount, spent_at, created_at, voided_at, created_by", profile?.company_id),
      ]);
      const pays = paysAll.filter((p: any) => !p.voided_at);
      const exps = expAll.filter((e: any) => !e.voided_at);

      const paidByLoan = new Map<string, number>();
      pays.forEach((p: any) => paidByLoan.set(p.loan_id, (paidByLoan.get(p.loan_id) ?? 0) + Number(p.amount)));

      let active = 0, outstanding = 0, overdue = 0;
      const now = new Date();
      const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      const todayStr = `${startDay.getFullYear()}-${pad(startDay.getMonth() + 1)}-${pad(startDay.getDate())}`;

      // Cash-out only counts loans that have actually been disbursed.
      // Approval alone does NOT move cash.
      const isDisbursed = (l: any) =>
        !!l.disbursed_at || ["active", "completed", "defaulted"].includes(l.status);

      let dayCashOut = 0;
      let dayFees = 0;
      const todaysDisbursements: Array<{ id: string; client: string; principal: number; charge: number; net: number; at: Date }> = [];
      const clientById = new Map<string, any>(clientsAll.map((c: any) => [c.id, c]));
      // Prefer a richer client cache when available.
      const clientsRich = await loadTableOffline<any>("clients", "id, full_name, phone", profile?.company_id);
      clientsRich.forEach((c: any) => clientById.set(c.id, c));

      loansAll.forEach((l: any) => {
        const principal = Number(l.principal);
        const charge = Math.max(0, Number(l.charge ?? 0));
        const net = Math.max(0, principal - charge);
        if (isDisbursed(l)) {
          const ts = l.disbursed_at ?? `${l.start_date}T00:00:00`;
          const at = new Date(ts);
          if (at >= startDay) {
            dayCashOut += net;
            dayFees += charge;
            const c = clientById.get(l.client_id);
            todaysDisbursements.push({
              id: l.id,
              client: c?.full_name ?? "—",
              principal,
              charge,
              net,
              at,
            });
          }
        }
        if (l.status === "active" || l.status === "approved") {
          active += 1;
          const paid = paidByLoan.get(l.id) ?? 0;
          outstanding += Math.max(0, Number(l.total_repayable) - paid);
          const due = new Date(l.start_date);
          due.setMonth(due.getMonth() + l.duration_months);
          if (due < now && paid < Number(l.total_repayable)) overdue += 1;
        }
      });
      todaysDisbursements.sort((a, b) => +b.at - +a.at);
      setDailyDisbursements(todaysDisbursements);

      const monthCollected = pays.filter((p: any) => new Date(p.paid_at) >= startMonth).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const dayCollected = pays.filter((p: any) => new Date(p.paid_at) >= startDay).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const dayExpenses = exps.filter((e: any) => e.spent_at === todayStr).reduce((s: number, e: any) => s + Number(e.amount), 0);

      // Drawer balance — scoped to THIS staff's session: only their own payments/loans/expenses
      let drawerBalance = 0;
      if (session) {
        const sinceTs = new Date(session.opened_at).getTime();
        const ownerId = user.id;
        const cashInSince = pays.filter((p: any) => p.created_by === ownerId && new Date(p.paid_at).getTime() >= sinceTs).reduce((s: number, p: any) => s + Number(p.amount), 0);
        const cashOutSince = loansAll.filter((l: any) => {
          if (!isDisbursed(l)) return false;
          if (l.created_by !== ownerId) return false;
          const ts = l.disbursed_at ?? `${l.start_date}T00:00:00`;
          return new Date(ts).getTime() >= sinceTs;
        }).reduce((s: number, l: any) => s + Math.max(0, Number(l.principal) - Number(l.charge ?? 0)), 0);
        const expensesSince = exps.filter((e: any) => e.created_by === ownerId && new Date(e.created_at).getTime() >= sinceTs).reduce((s: number, e: any) => s + Number(e.amount), 0);
        drawerBalance = Number(session.opening_balance) + cashInSince - cashOutSince - expensesSince;
      }

      setStats({
        activeLoans: active,
        outstanding,
        overdue,
        dayCollected,
        monthCollected,
        clients: clientsAll.length,
        dayCashOut,
        dayExpenses,
        dayFees,
        drawerBalance,
      });
    })();
  }, [user, session, refreshKey]);

  // Analytics data — offline-first; the charts compute from the full set client-side.
  useEffect(() => {
    if (!isAdmin || !profile?.company_id) return;
    (async () => {
      const fromMs = +range.from;
      const toMs = +range.to;
      const fromDate = range.from.toISOString().slice(0, 10);
      const toDate = range.to.toISOString().slice(0, 10);
      const [loansData, paysAll, expAll] = await Promise.all([
        loadTableOffline<any>("loans", "id, principal, total_repayable, status, start_date, disbursed_at, duration_months, payment_frequency", profile.company_id),
        loadTableOffline<any>("payments", "id, loan_id, amount, paid_at, voided_at", profile.company_id),
        loadTableOffline<any>("expenses", "id, amount, spent_at, voided_at", profile.company_id),
      ]);
      const pays = paysAll.filter((p: any) => !p.voided_at);
      const exps = expAll.filter((e: any) => !e.voided_at);
      // Charts expect a grace_period_days field — default to 0.
      const loansForCharts = loansData.map((l: any) => ({ ...l, grace_period_days: 0 }));
      setLoans(loansForCharts as any);
      setAllPayments(pays as any);
      setRangePayments(pays.filter((p: any) => {
        const t = +new Date(p.paid_at);
        return t >= fromMs && t <= toMs;
      }) as any);
      setRangeExpenses(exps.filter((e: any) => e.spent_at >= fromDate && e.spent_at <= toDate) as any);
    })();
  }, [range, isAdmin]);

  const cards = useMemo(() => [
    { label: "Drawer balance", value: session ? formatMoney(stats.drawerBalance, settings) : "Closed", icon: Wallet, link: "/payments", warn: session ? stats.drawerBalance < 0 : false },
    { label: "Daily Cash-in", value: formatMoney(stats.dayCollected, settings), icon: Banknote, link: "/payments" },
    { label: "Daily Cash-out", value: formatMoney(stats.dayCashOut, settings), icon: ArrowDownCircle, link: "/loans" },
    { label: "Daily Fees", value: formatMoney(stats.dayFees, settings), icon: TrendingUp, link: "/loans" },
    { label: "Daily Expenses", value: formatMoney(stats.dayExpenses, settings), icon: Receipt, link: "/expenses" },
    { label: "Monthly Cash-in", value: formatMoney(stats.monthCollected, settings), icon: TrendingUp, link: "/payments" },
    { label: "Outstanding balance", value: formatMoney(stats.outstanding, settings), icon: TrendingUp, link: "/loans" },
    { label: "Active loans", value: stats.activeLoans, icon: Banknote, link: "/loans" },
    { label: "Overdue loans", value: stats.overdue, icon: AlertTriangle, link: "/loans", warn: true },
    { label: "Total clients", value: stats.clients, icon: Users, link: "/clients" },
  ], [stats, settings, session]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const sessionFromPriorDay = session && new Date(session.opened_at).toDateString() !== new Date().toDateString();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your lending business.</p>
        </div>
        {session ? (
          <Button onClick={() => setCloseOpen(true)}>
            <Lock className="w-4 h-4 mr-2" /> Close drawer
          </Button>
        ) : sessionChecked ? (
          <Button onClick={() => setOpenOpen(true)}>
            <Unlock className="w-4 h-4 mr-2" /> Open drawer
          </Button>
        ) : null}
      </div>

      {sessionFromPriorDay && (
        <Card className="p-4 border-destructive bg-destructive/5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-destructive">Drawer session opened on a previous day</p>
            <p className="text-xs text-muted-foreground">
              Opened {new Date(session!.opened_at).toLocaleString()}. Close it to start fresh.
            </p>
          </div>
          <Button size="sm" variant="destructive" onClick={() => setCloseOpen(true)}>
            Close session
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.link} className="h-full">
            <Card className="p-3 sm:p-5 h-full hover:shadow-elegant transition-shadow cursor-pointer">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 h-full">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem] sm:min-h-0">{c.label}</p>
                  <p className={`text-base sm:text-2xl font-bold mt-1 break-words ${c.warn && Number(c.value) > 0 ? "text-destructive" : ""}`}>{c.value}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-auto sm:mt-0 self-start">
                  <c.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Daily cash-out — today's disbursements */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Daily Cash-out</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {dailyDisbursements.length} disbursement{dailyDisbursements.length === 1 ? "" : "s"} · {formatMoney(stats.dayCashOut, settings)}
          </p>
        </div>
        {dailyDisbursements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No principal disbursed yet today.</p>
        ) : (
          <div className="divide-y">
            {dailyDisbursements.map((d) => (
              <Link key={d.id} to={`/loans/${d.id}`} className="flex items-center justify-between gap-3 py-2 hover:bg-muted/40 -mx-2 px-2 rounded">
                <div className="min-w-0">
                  <p className="font-medium truncate">{d.client}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {d.charge > 0 && <> · fee {formatMoney(d.charge, settings)}</>}
                  </p>
                </div>
                <span className="font-semibold shrink-0">-{formatMoney(d.net, settings)}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {isAdmin && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
            <DateRangeFilter range={range} onRangeChange={setRange} preset={preset} onPresetChange={setPreset} />
            <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as Mode)} variant="outline" size="sm" className="grid grid-cols-2 w-full sm:flex sm:w-auto">
              <ToggleGroupItem value="amount" className="w-full">By Amount</ToggleGroupItem>
              <ToggleGroupItem value="count" className="w-full">By Count</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CashFlowChart range={range} mode={mode} loans={loans} payments={rangePayments} expenses={rangeExpenses} />
            <LoanStatusChart range={range} mode={mode} loans={loans} payments={allPayments} />
            <RepaymentChart range={range} mode={mode} loans={loans} allPayments={allPayments} />
            <ProfitChart range={range} loans={loans} payments={rangePayments} expenses={rangeExpenses} />
          </div>
        </>
      )}

      <OpenDrawerDialog
        open={openOpen}
        onOpenChange={setOpenOpen}
        onOpened={() => setRefreshKey((k) => k + 1)}
      />
      <CloseDrawerDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        session={session}
        onClosed={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
