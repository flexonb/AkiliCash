import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Plus, Check, X, Banknote, ChevronDown, CheckCircle2, AlertTriangle, CalendarCog } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSettings, formatMoney } from "@/hooks/useSettings";
import { PaymentForm } from "@/components/PaymentForm";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { buildSchedule, allocatePayments } from "@/lib/schedule";
import { useConfirmSave } from "@/components/ConfirmSave";
import { logAudit } from "@/lib/audit";
import { PageSkeleton } from "@/components/PageSkeleton";

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "completed") return "secondary";
  if (s === "defaulted" || s === "rejected") return "destructive";
  if (s === "pending") return "outline";
  return "default";
};

export default function LoanDetail() {
  const { id } = useParams();
  const { settings } = useSettings();
  const { user, profile, isAdmin } = useAuth();
  const [loan, setLoan] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [createdByName, setCreatedByName] = useState<string>("");
  const [approvedByName, setApprovedByName] = useState<string>("");
  const [openPayment, setOpenPayment] = useState(false);
  const [openReject, setOpenReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [openApprove, setOpenApprove] = useState(false);
  const [sameDayFirst, setSameDayFirst] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmSave = useConfirmSave();
  const [voidTarget, setVoidTarget] = useState<any>(null);
  const [voidReason, setVoidReason] = useState("");
  const [openDates, setOpenDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");
  const [editDisbursedDate, setEditDisbursedDate] = useState("");
  const [editDatesNote, setEditDatesNote] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const load = async () => {
    if (!id || !profile?.company_id) return;
    setPageLoading(true);
    try {
      const [{ data: l }, { data: p }] = await Promise.all([
        api.from("loans").select("*, clients(id, full_name, phone)").eq("id", id).eq("company_id", profile.company_id).maybeSingle(),
        api.from("payments").select("*").eq("loan_id", id).eq("company_id", profile.company_id).is("voided_at", null),
      ]);
      setLoan(l);
      const sortedPayments = (p ?? []).sort((a: any, b: any) => +new Date(b.paid_at) - +new Date(a.paid_at));
      setPayments(sortedPayments);

      const ids = [l?.created_by, l?.approved_by, l?.rejected_by].filter(Boolean) as string[];
      if (ids.length) {
        const { data: profs } = await api.from("profiles").select("id, full_name").in("id", ids);
        const map = new Map((profs ?? []).map((x: any) => [x.id, x.full_name ?? "—"]));
        setCreatedByName(map.get(l?.created_by) ?? "");
        setApprovedByName(map.get(l?.approved_by ?? l?.rejected_by) ?? "");
      }
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, profile?.company_id]);

  if (pageLoading) return <PageSkeleton />;
  if (!loan) return <div className="p-8 text-center text-muted-foreground">Loan not found.</div>;

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.max(0, Number(loan.total_repayable) - totalPaid);
  const isOwner = loan.created_by === user?.uid;

  async function update(patch: any, successMsg: string, summary?: string) {
    if (summary) {
      const ok = await confirmSave({ title: "Update loan?", summary, confirmLabel: "Confirm" });
      if (!ok) return;
    }
    setBusy(true);
    const before = { ...loan };
    const { error } = await api.from("loans").update(patch).eq("id", loan.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await logAudit({ entity_type: "loan", entity_id: loan.id, action: "update", note: successMsg, before, after: { ...before, ...patch } });
    toast.success(successMsg);
    load();
  }

  async function voidPayment() {
    if (!voidTarget) return;
    if (!voidReason.trim()) return toast.error("Please enter a reason");
    setBusy(true);
    const { data, error } = await api.from("payments").update({
      voided_at: new Date().toISOString(),
      voided_by: user?.uid,
      void_reason: voidReason.trim(),
    }).eq("id", voidTarget.id).is("voided_at", null).select("id");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) {
      toast.error("Already voided or not permitted");
      setVoidTarget(null); setVoidReason(""); load();
      return;
    }
    await logAudit({
      entity_type: "payment",
      entity_id: voidTarget.id,
      action: "void",
      note: voidReason.trim(),
      before: voidTarget,
    });
    toast.success("Payment voided");
    setVoidTarget(null);
    setVoidReason("");
    load();
  }

  const approve = async () => {
    setOpenApprove(false);
    const today = new Date();
    const startDate = sameDayFirst
      ? today.toISOString().slice(0, 10)
      : new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await update(
      { status: "approved", approved_by: user?.uid, approved_at: today.toISOString(), start_date: startDate },
      "Loan approved",
    );
  };
  const openDisburse = () => {
    const today = new Date().toISOString().slice(0, 10);
    setEditDisbursedDate(today);
    setEditStartDate(loan.start_date ?? today);
    setEditDatesNote("");
    setOpenDates(true);
  };
  const disburseWithDate = async () => {
    if (!editDisbursedDate) return toast.error("Pick a disbursement date");
    setOpenDates(false);
    const disbursedAt = new Date(editDisbursedDate + "T12:00:00").toISOString();
    await update(
      { status: "active", disbursed_at: disbursedAt, disbursed_by: user?.uid, start_date: editStartDate || loan.start_date },
      "Marked as disbursed",
      `Disburse on ${editDisbursedDate}, first installment from ${editStartDate}?`,
    );
  };
  const openEditDates = () => {
    setEditStartDate(loan.start_date ?? "");
    setEditDisbursedDate(loan.disbursed_at ? new Date(loan.disbursed_at).toISOString().slice(0, 10) : "");
    setEditDatesNote("");
    setOpenDates(true);
  };
  const saveDates = async () => {
    if (!editStartDate) return toast.error("Start date is required");
    setOpenDates(false);
    const patch: any = { start_date: editStartDate };
    if (editDisbursedDate) patch.disbursed_at = new Date(editDisbursedDate + "T12:00:00").toISOString();
    await update(
      patch,
      "Loan dates updated",
      `Set start date to ${editStartDate}${editDisbursedDate ? ` and disbursed on ${editDisbursedDate}` : ""}.${editDatesNote ? ` Reason: ${editDatesNote}` : ""}`,
    );
  };
  const markCompleted = () => update({ status: "completed" }, "Loan marked as completed", "Mark this loan as completed?");
  const markDefault = () => update({ status: "defaulted" }, "Loan marked as defaulted", "Mark this loan as defaulted?");
  const cancelRequest = () => update({ status: "rejected", rejected_reason: "Cancelled by requester" }, "Request cancelled", "Cancel this loan request?");

  async function submitReject() {
    setOpenReject(false);
    await update(
      {
        status: "rejected",
        rejected_by: user?.uid,
        rejected_at: new Date().toISOString(),
        rejected_reason: rejectReason || null,
      },
      "Loan rejected"
    );
    setRejectReason("");
  }

  return (
    <div className="space-y-6">
      <Link to="/loans" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Cash-out
      </Link>

      <Card className="p-6 space-y-3">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            {loan.clients?.id ? (
              <Link to={`/clients/${loan.clients.id}`} className="text-sm text-primary hover:underline">{loan.clients?.full_name}</Link>
            ) : (
              <span className="text-sm text-primary">{loan.clients?.full_name ?? "—"}</span>
            )}
            <h1 className="text-2xl font-bold">{formatMoney(loan.principal, settings)}</h1>
            <p className="text-sm text-muted-foreground">{loan.interest_rate}% · {loan.duration_months} months · {loan.payment_frequency} · starts {loan.start_date}</p>
          </div>
          <Badge variant={statusVariant(loan.status)}>{loan.status}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div><p className="text-xs text-muted-foreground">Total repayable</p><p className="font-semibold">{formatMoney(loan.total_repayable, settings)}</p></div>
          <div><p className="text-xs text-muted-foreground">Paid</p><p className="font-semibold text-success">{formatMoney(totalPaid, settings)}</p></div>
          <div><p className="text-xs text-muted-foreground">Balance</p><p className="font-semibold">{formatMoney(balance, settings)}</p></div>
        </div>

        {Number(loan.charge ?? 0) > 0 && (
          <div className="grid grid-cols-2 gap-4 pt-3 border-t">
            <div><p className="text-xs text-muted-foreground">Charge (fee)</p><p className="font-semibold">{formatMoney(loan.charge, settings)}</p></div>
            <div><p className="text-xs text-muted-foreground">Cash to client</p><p className="font-semibold">{formatMoney(Math.max(0, Number(loan.principal) - Number(loan.charge ?? 0)), settings)}</p></div>
          </div>
        )}

        {loan.status === "approved" && (
          <p className="text-xs text-muted-foreground italic">
            Approved — no cash has moved yet. Disburse the principal to record the cash-out.
          </p>
        )}

        {/* Action buttons (role-gated) */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
          {loan.status === "pending" && isAdmin && (
            <>
              <Button onClick={() => { setSameDayFirst(false); setOpenApprove(true); }} disabled={busy}><Check className="w-4 h-4 mr-1" /> Approve</Button>
              <Button variant="destructive" onClick={() => setOpenReject(true)} disabled={busy}><X className="w-4 h-4 mr-1" /> Reject</Button>
            </>
          )}
          {loan.status === "pending" && !isAdmin && isOwner && (
            <Button variant="outline" onClick={cancelRequest} disabled={busy}>Cancel request</Button>
          )}
          {loan.status === "approved" && isAdmin && (
            <Button onClick={openDisburse} disabled={busy}><Banknote className="w-4 h-4 mr-1" /> Disburse principal</Button>
          )}
          {isAdmin && ["approved", "active", "completed", "defaulted"].includes(loan.status) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={busy}>
                  Update <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={openEditDates}>
                  <CalendarCog className="w-4 h-4 mr-2" /> Edit dates (backdate)
                </DropdownMenuItem>
                {["approved", "active"].includes(loan.status) && (
                  <>
                    <DropdownMenuItem onClick={markCompleted}>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-success" /> Mark loan as completed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={markDefault} className="text-destructive focus:text-destructive">
                      <AlertTriangle className="w-4 h-4 mr-2" /> Mark loan as defaulted
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {loan.status === "pending" && !isAdmin && !isOwner && (
            <p className="text-sm text-muted-foreground">Awaiting admin approval.</p>
          )}
        </div>
      </Card>

      {/* Audit trail */}
      <Card className="p-5 space-y-2">
        <h2 className="font-semibold">Audit trail</h2>
        <div className="text-sm space-y-1">
          <p><span className="text-muted-foreground">Requested:</span> {new Date(loan.created_at).toLocaleString()}{createdByName && ` · by ${createdByName}`}</p>
          {loan.approved_at && (
            <p><span className="text-muted-foreground">Approved:</span> {new Date(loan.approved_at).toLocaleString()}{approvedByName && ` · by ${approvedByName}`}</p>
          )}
          {loan.disbursed_at && (
            <p><span className="text-muted-foreground">Disbursed:</span> {new Date(loan.disbursed_at).toLocaleString()}</p>
          )}
          {loan.rejected_at && (
            <p>
              <span className="text-muted-foreground">Rejected:</span> {new Date(loan.rejected_at).toLocaleString()}
              {loan.rejected_reason && <span className="block text-muted-foreground italic mt-1">"{loan.rejected_reason}"</span>}
            </p>
          )}
        </div>
      </Card>

      {/* Repayment schedule */}
      {(() => {
        const sched = buildSchedule({
          startDate: loan.start_date,
          durationMonths: loan.duration_months,
          frequency: (loan.payment_frequency ?? "monthly"),
          gracePeriodDays: 0,
          totalRepayable: Number(loan.total_repayable),
        });
        const fmt = (d: Date) => d.toLocaleDateString();
        const { allocations, paymentCovers } = allocatePayments(sched.items, payments as any);
        const counts = allocations.reduce(
          (a, x) => { a[x.status]++; return a; },
          { paid: 0, paid_late: 0, partial: 0, missed: 0, pending: 0 } as Record<string, number>
        );
        const STATUS_META: Record<string, { label: string; cls: string }> = {
          paid:      { label: "Paid",      cls: "bg-success/15 text-success" },
          paid_late: { label: "Paid late", cls: "bg-warning/15 text-warning" },
          partial:   { label: "Partial",   cls: "bg-warning/15 text-warning" },
          missed:    { label: "Missed",    cls: "bg-destructive/15 text-destructive" },
          pending:   { label: "Pending",   cls: "bg-muted text-muted-foreground" },
        };
        return (
          <Card className="p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Repayment schedule</h2>
              <span className="text-xs text-muted-foreground">{sched.items.length} {loan.payment_frequency} installments</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">First payment due</p><p className="font-medium">{fmt(sched.firstDue)}</p></div>
              <div><p className="text-xs text-muted-foreground">Final payment due</p><p className="font-medium">{fmt(sched.finalDue)}</p></div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span><span className="text-success font-medium">{counts.paid}</span> paid</span>
              <span><span className="text-warning font-medium">{counts.paid_late}</span> late</span>
              <span><span className="text-warning font-medium">{counts.partial}</span> partial</span>
              <span><span className="text-destructive font-medium">{counts.missed}</span> missed</span>
              <span><span className="font-medium">{counts.pending}</span> pending</span>
            </div>
            <div className="max-h-72 overflow-auto border-t pt-2 space-y-1">
              {allocations.map((a) => {
                const meta = STATUS_META[a.status];
                const overdueAmount = a.status === "missed" || a.status === "partial";
                return (
                  <div key={a.index} className="flex justify-between items-center text-sm py-1 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-muted-foreground truncate">#{a.index} · {fmt(a.due)}</div>
                      {a.closedAt && (
                        <div className="text-[10px] text-muted-foreground">paid {a.closedAt.toLocaleDateString()}</div>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${meta.cls}`}>{meta.label}</span>
                    <span className={`font-medium shrink-0 ${overdueAmount ? "text-destructive" : ""}`}>{formatMoney(a.amount, settings)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        );

        // Payment ledger uses paymentCovers via outer scope below — rebuilt there.
      })()}

      {/* Payment ledger */}
      {(() => {
        const sched = buildSchedule({
          startDate: loan.start_date,
          durationMonths: loan.duration_months,
          frequency: (loan.payment_frequency ?? "monthly"),
          gracePeriodDays: 0,
          totalRepayable: Number(loan.total_repayable),
        });
        const { paymentCovers } = allocatePayments(sched.items, payments as any);
        return (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Payment ledger</h2>
              <Button
                onClick={() => setOpenPayment(true)}
                disabled={balance === 0 || !["active", "approved"].includes(loan.status)}
              >
                <Plus className="w-4 h-4 mr-1" /> Record payment
              </Button>
            </div>
            <div className="grid gap-2">
              {payments.map((p) => {
                const covers = paymentCovers[p.id] ?? [];
                return (
                  <Card key={p.id} className="p-3 flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{formatMoney(p.amount, settings)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.paid_at).toLocaleString()}{p.method ? ` · ${p.method}` : ""}{p.reference ? ` · ${p.reference}` : ""}
                      </p>
                      {covers.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Covers {covers.map((i) => `#${i}`).join(", ")}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => { setVoidTarget(p); setVoidReason(""); }}>Void</Button>
                  </Card>
                );
              })}
              {payments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
            </div>
          </section>
        );
      })()}

      <PaymentForm open={openPayment} onOpenChange={setOpenPayment} loanId={loan.id} maxAmount={balance} onCreated={load} />

      <Dialog open={openApprove} onOpenChange={setOpenApprove}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Approve loan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              By default, the first installment will be due <strong>tomorrow</strong>.
            </p>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={sameDayFirst}
                onChange={(e) => setSameDayFirst(e.target.checked)}
              />
              <span>Client requested first installment <strong>today</strong> (same day as approval).</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenApprove(false)}>Cancel</Button>
            <Button onClick={approve} disabled={busy}><Check className="w-4 h-4 mr-1" /> Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={openReject} onOpenChange={setOpenReject}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject loan request</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="e.g. Insufficient guarantor coverage" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenReject(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!voidTarget} onOpenChange={(o) => { if (!o) setVoidTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Void payment</DialogTitle></DialogHeader>
          {voidTarget && (
            <div className="space-y-3">
              <p className="text-sm">{formatMoney(voidTarget.amount, settings)} · {new Date(voidTarget.paid_at).toLocaleString()}</p>
              <div>
                <Label>Reason (required)</Label>
                <Textarea rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Why are you voiding this payment?" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setVoidTarget(null)}>Cancel</Button>
                <Button variant="destructive" onClick={voidPayment}>Void payment</Button>
              </DialogFooter>
              <p className="text-xs text-muted-foreground">To correct the amount, void this entry then record a new payment with the right amount.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openDates} onOpenChange={setOpenDates}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{loan.status === "approved" ? "Disburse loan" : "Edit loan dates"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Use this to record loans you issued before going digital. Pick the actual dates so the schedule and reports reflect reality.
            </p>
            <div>
              <Label>Disbursement date</Label>
              <Input type="date" value={editDisbursedDate} onChange={(e) => setEditDisbursedDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              <p className="text-[11px] text-muted-foreground mt-1">When the cash was actually given to the client.</p>
            </div>
            <div>
              <Label>First-installment start date</Label>
              <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">Drives the repayment schedule.</p>
            </div>
            {loan.status !== "approved" && (
              <div>
                <Label>Reason (optional)</Label>
                <Textarea rows={2} value={editDatesNote} onChange={(e) => setEditDatesNote(e.target.value)} placeholder="e.g. Migrating paper records" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDates(false)}>Cancel</Button>
            <Button onClick={loan.status === "approved" ? disburseWithDate : saveDates} disabled={busy}>
              {loan.status === "approved" ? "Disburse" : "Save dates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
