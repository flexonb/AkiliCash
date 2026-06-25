import { useEffect, useState } from "react";
import { Card } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSettings, formatMoney } from "@/hooks/useSettings";
import { Download, ChevronDown, ChevronRight } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { generateDailyReport } from "@/lib/dailyReport";
import { toast } from "sonner";

export default function Drawer() {
  const { profile, isAdmin, loading: authLoading } = useAuth();
  const { settings } = useSettings();
  const [closures, setClosures] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAdmin || !profile?.company_id) return;
    (async () => {
      const [{ data: cls }, { data: ses }] = await Promise.all([
        api.from("drawer_closures").select("*").eq("company_id", profile.company_id).order("close_date", { ascending: false }),
        api.from("drawer_sessions").select("*").eq("company_id", profile.company_id).order("opened_at", { ascending: false }),
      ]);
      setClosures(cls ?? []);
      setSessions(ses ?? []);
      const ids = Array.from(new Set([
        ...((cls ?? []).map((c: any) => c.closed_by).filter(Boolean)),
        ...((ses ?? []).map((s: any) => s.opened_by).filter(Boolean)),
        ...((ses ?? []).map((s: any) => s.closed_by).filter(Boolean)),
      ]));
      if (ids.length) {
        const { data: profs } = await api.from("profiles").select("id, full_name").in("id", ids);
        setProfileMap(new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? p.id])));
      }
    })();
  }, [isAdmin, profile?.company_id]);

  const nameOf = (id?: string | null) => (id ? (profileMap.get(id) ?? id) : "—");

  function toggle(date: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(date) ? n.delete(date) : n.add(date);
      return n;
    });
  }

  async function reDownload(c: any) {
    try {
      const dayStart = `${c.close_date}T00:00:00.000Z`;
      const dayEnd = `${c.close_date}T23:59:59.999Z`;
      const ownerId = c.closed_by;
      const [{ data: pays }, { data: loans }, { data: missed }] = await Promise.all([
        api
          .from("payments")
          .select("amount, paid_at, method, loan_id, created_by")
          .is("voided_at", null)
          .eq("created_by", ownerId)
          .gte("paid_at", dayStart)
          .lte("paid_at", dayEnd),
        api
          .from("loans")
          .select("id, principal, charge, client_id, disbursed_at, created_by")
          .eq("created_by", ownerId)
          .gte("disbursed_at", dayStart)
          .lte("disbursed_at", dayEnd),
        api.from("missed_payments").select("loan_id, client_id").eq("drawer_closure_id", c.id),
      ]);
      const allClientIds = Array.from(
        new Set([
          ...((loans ?? []).map((l: any) => l.client_id)),
          ...((missed ?? []).map((m: any) => m.client_id)),
        ]),
      );
      const loanIds = Array.from(new Set((pays ?? []).map((p: any) => p.loan_id)));
      const { data: loanRows } = loanIds.length
        ? await api.from("loans").select("id, client_id").in("id", loanIds)
        : { data: [] as any[] };
      const allIds = Array.from(new Set([...allClientIds, ...((loanRows ?? []).map((l: any) => l.client_id))]));
      const { data: clientRows } = allIds.length
        ? await api.from("clients").select("id, full_name, phone").in("id", allIds)
        : { data: [] as any[] };
      const clientMap = new Map((clientRows ?? []).map((x: any) => [x.id, x]));
      const loanClientMap = new Map((loanRows ?? []).map((l: any) => [l.id, l.client_id]));

      const missedLoanIds = (missed ?? []).map((m: any) => m.loan_id);
      const { data: missedLoans } = missedLoanIds.length
        ? await api.from("loans").select("id, total_repayable, client_id").in("id", missedLoanIds)
        : { data: [] as any[] };
      const { data: allPays2 } = await api
        .from("payments")
        .select("loan_id, amount")
        .is("voided_at", null);
      const paidByLoan = new Map<string, number>();
      (allPays2 ?? []).forEach((p: any) =>
        paidByLoan.set(p.loan_id, (paidByLoan.get(p.loan_id) ?? 0) + Number(p.amount)),
      );

      let closedByLabel = "—";
      if (c.closed_by) {
        const { data: prof } = await api.from("profiles").select("full_name").eq("id", c.closed_by).maybeSingle();
        closedByLabel = prof?.full_name ?? c.closed_by;
      }

      generateDailyReport(
        {
          date: c.close_date,
          closedBy: closedByLabel,
          opening: Number(c.opening_balance),
          cashIn: Number(c.cash_in),
          cashOut: Number(c.cash_out),
          expenses: Number(c.expenses_total),
          expected: Number(c.expected_close),
          actual: Number(c.actual_close),
          variance: Number(c.variance),
          note: c.note,
          payments: (pays ?? []).map((p: any) => {
            const cid = loanClientMap.get(p.loan_id);
            return {
              time: new Date(p.paid_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              client: cid ? clientMap.get(cid)?.full_name ?? "—" : "—",
              method: p.method,
              amount: Number(p.amount),
            };
          }),
          disbursements: (loans ?? []).map((l: any) => ({
            time: new Date(l.disbursed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            client: clientMap.get(l.client_id)?.full_name ?? "—",
            principal: Math.max(0, Number(l.principal) - Number(l.charge ?? 0)),
          })),
          missed: (missedLoans ?? []).map((l: any) => {
            const cl = clientMap.get(l.client_id);
            return {
              client: cl?.full_name ?? "—",
              phone: cl?.phone ?? "—",
              outstanding: Math.max(0, Number(l.total_repayable) - (paidByLoan.get(l.id) ?? 0)),
            };
          }),
        },
        settings,
      );
    } catch (e: any) {
      console.error("PDF download failed", e);
      toast.error(e?.message ?? "Failed to generate PDF");
    }
  }

  if (authLoading) return <PageSkeleton />;
  if (!isAdmin) return <Navigate to="/loans" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Drawer history</h1>
        <p className="text-muted-foreground">Past daily closes and reports.</p>
      </div>
      <div className="space-y-2">
        {closures.map((c) => {
          const daySessions = sessions.filter(
            (s) =>
              s.opened_at &&
              s.opened_at.slice(0, 10) === c.close_date &&
              (s.opened_by === c.closed_by || s.closed_by === c.closed_by),
          );
          const key = `${c.close_date}-${c.closed_by}`;
          const isOpen = expanded.has(key);
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <button
                  className="flex items-center gap-2 text-left"
                  onClick={() => toggle(key)}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <div>
                    <p className="font-semibold">
                      {c.close_date} <span className="text-muted-foreground font-normal">· {nameOf(c.closed_by)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expected {formatMoney(Number(c.expected_close), settings)} · Actual{" "}
                      {formatMoney(Number(c.actual_close), settings)} · {daySessions.length} session{daySessions.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${Number(c.variance) === 0 ? "" : Number(c.variance) > 0 ? "text-green-600" : "text-destructive"}`}
                  >
                    {Number(c.variance) >= 0 ? "+" : "-"}
                    {formatMoney(Math.abs(Number(c.variance)), settings)}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => reDownload(c)}>
                    <Download className="w-4 h-4 mr-1" /> PDF
                  </Button>
                </div>
              </div>
              {isOpen && daySessions.length > 0 && (
                <div className="mt-3 pl-6 space-y-1">
                  {daySessions.map((s) => {
                    const v = Number(s.variance ?? 0);
                    return (
                      <div key={s.id} className="flex items-center justify-between text-xs border-b pb-1">
                        <div>
                          <p className="font-medium">
                            {new Date(s.opened_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" → "}
                            {s.closed_at ? new Date(s.closed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "open"}
                          </p>
                          <p className="text-muted-foreground">
                            Opened by {nameOf(s.opened_by)}
                            {s.closed_by && s.closed_by !== s.opened_by && <> · closed by {nameOf(s.closed_by)}</>}
                          </p>
                          <p className="text-muted-foreground">
                            Open {formatMoney(Number(s.opening_balance), settings)} · Actual{" "}
                            {formatMoney(Number(s.actual_close ?? 0), settings)}
                          </p>
                        </div>
                        <span className={v === 0 ? "" : v > 0 ? "text-green-600 font-semibold" : "text-destructive font-semibold"}>
                          {v >= 0 ? "+" : "-"}{formatMoney(Math.abs(v), settings)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
        {closures.length === 0 && (
          <p className="text-sm text-muted-foreground">No closures yet.</p>
        )}
      </div>
    </div>
  );
}

