import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, formatMoney } from "@/hooks/useSettings";
import { Plus, Loader2, Repeat, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useConfirmSave } from "@/components/ConfirmSave";
import { logAudit } from "@/lib/audit";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { sbInsert } from "@/lib/offline/sb";
import { PageSkeleton } from "@/components/PageSkeleton";

const schema = z.object({
  category: z.string().trim().min(1).max(50),
  amount: z.coerce.number().int().positive().max(1_000_000_000),
  spent_at: z.string().min(1),
  note: z.string().trim().max(255).optional(),
});

const recSchema = z.object({
  category: z.string().trim().min(1).max(50),
  amount: z.coerce.number().int().positive().max(1_000_000_000),
  frequency: z.enum(["monthly", "weekly"]),
  day_of_month: z.coerce.number().int().min(1).max(31).optional(),
  day_of_week: z.coerce.number().int().min(0).max(6).optional(),
  note: z.string().trim().max(255).optional(),
});

type Period = "today" | "week" | "month" | "all";

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
};
const startOfMonth = (d: Date) => { const x = startOfDay(d); x.setDate(1); return x; };
const toISO = (d: Date) => d.toISOString().slice(0, 10);

// Compute next due date for a recurring template
function nextDueDate(t: any): Date {
  const today = startOfDay(new Date());
  const base = t.last_posted_on ? startOfDay(new Date(t.last_posted_on)) : null;

  if (t.frequency === "weekly") {
    const dow = ((t.day_of_week ?? 0) + 1) % 7; // store Mon=0; JS Sun=0
    const start = base ? new Date(base.getTime() + 86400000) : today;
    const d = new Date(start);
    while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
    return d;
  }
  // monthly
  const dom = Math.min(Math.max(t.day_of_month ?? 1, 1), 28);
  const ref = base ?? new Date(today.getFullYear(), today.getMonth(), 1);
  const candidate = new Date(ref.getFullYear(), ref.getMonth(), dom);
  if (base && candidate <= base) candidate.setMonth(candidate.getMonth() + 1);
  if (!base && candidate < today) candidate.setMonth(candidate.getMonth() + 1);
  // Roll forward if still before today and never posted? keep first upcoming
  return candidate;
}

const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function Expenses() {
  const { profile, isStaff } = useAuth();
  const { settings } = useSettings();
  const confirmSave = useConfirmSave();
  const [rows, setRows] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [recOpen, setRecOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recLoading, setRecLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [chartPeriod, setChartPeriod] = useState<Period>("month");
  const [voidTarget, setVoidTarget] = useState<any>(null);
  const [voidReason, setVoidReason] = useState("");
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editReason, setEditReason] = useState("");

  const editForm = useForm({
    resolver: zodResolver(schema),
    defaultValues: { category: "", amount: 0, spent_at: toISO(new Date()), note: "" },
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { category: "Transport", amount: 0, spent_at: toISO(new Date()), note: "" },
  });

  const recForm = useForm({
    resolver: zodResolver(recSchema),
    defaultValues: { category: "Rent", amount: 0, frequency: "monthly" as const, day_of_month: 1, day_of_week: 0, note: "" },
  });
  const recFreq = recForm.watch("frequency");

  const [pageLoading, setPageLoading] = useState(true);

  const load = async () => {
    if (!profile?.company_id) return;
    setPageLoading(true);
    try {
      const [{ data: e }, { data: r }] = await Promise.all([
        api.from("expenses").select("*").eq("company_id", profile.company_id).is("voided_at", null),
        api.from("recurring_expenses").select("*").eq("company_id", profile.company_id),
      ]);
      const sortedExpenses = (e ?? []).sort((a: any, b: any) => +new Date(b.spent_at) - +new Date(a.spent_at));
      setRows(sortedExpenses.slice(0, 500));
      
      // Sort locally to handle missing created_at
      const sortedRecurring = (r ?? []).sort((a: any, b: any) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
      setRecurring(sortedRecurring);
    } finally {
      setPageLoading(false);
    }
  };
  useEffect(() => { load(); }, [profile?.company_id]);

  async function submit(values: z.infer<typeof schema>) {
    const ok = await confirmSave({
      title: "Save expense?",
      summary: `${values.category} · ${formatMoney(values.amount, settings)} on ${values.spent_at}.`,
    });
    if (!ok) return;
    setLoading(true);
    const { data: { user } } = await api.auth.getUser();
    const newId = crypto.randomUUID();
    const { error, queued } = await sbInsert("expenses", {
      id: newId,
      company_id: profile?.company_id,
      category: values.category, amount: values.amount, spent_at: values.spent_at,
      note: values.note || null, created_by: user?.uid,
    });
    setLoading(false);
    if (error) return toast.error((error as any).message ?? String(error));
    await logAudit({ entity_type: "expense", entity_id: newId, action: "create", after: values });
    toast.success(queued ? "Expense saved offline — will sync when online" : "Expense recorded");
    form.reset({ category: "Transport", amount: 0, spent_at: toISO(new Date()), note: "" });
    load();
    setOpen(false);
  }

  async function voidExpense() {
    if (!voidTarget) return;
    if (!voidReason.trim()) return toast.error("Please enter a reason");
    const { data: { user } } = await api.auth.getUser();
    const { data, error } = await api.from("expenses").update({
      voided_at: new Date().toISOString(),
      voided_by: user?.uid,
      void_reason: voidReason.trim(),
    }).eq("id", voidTarget.id).is("voided_at", null).select("id");
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) {
      toast.error("Already voided or not permitted");
      setVoidTarget(null); setVoidReason(""); load();
      return;
    }
    await logAudit({
      entity_type: "expense",
      entity_id: voidTarget.id,
      action: "void",
      note: voidReason.trim(),
      before: voidTarget,
    });
    toast.success("Expense voided");
    setVoidTarget(null);
    setVoidReason("");
    load();
  }

  function openEdit(t: any) {
    setEditTarget(t);
    setEditReason("");
    editForm.reset({ category: t.category, amount: Number(t.amount), spent_at: t.spent_at, note: t.note ?? "" });
  }

  async function submitEdit(values: z.infer<typeof schema>) {
    if (!editTarget) return;
    if (!editReason.trim()) return toast.error("Please enter a reason for the change");
    const ok = await confirmSave({
      title: "Replace expense?",
      summary: `Void original (${formatMoney(editTarget.amount, settings)}) and save corrected ${formatMoney(values.amount, settings)}.`,
      confirmLabel: "Save correction",
    });
    if (!ok) return;
    const { data: { user } } = await api.auth.getUser();
    // Void original
    const { error: vErr } = await api.from("expenses").update({
      voided_at: new Date().toISOString(), voided_by: user?.uid, void_reason: editReason.trim(),
    }).eq("id", editTarget.id);
    if (vErr) return toast.error(vErr.message);
    await logAudit({ entity_type: "expense", entity_id: editTarget.id, action: "void", note: editReason.trim(), before: editTarget });
    // Insert replacement
    const { data: insertedList, error: iErr } = await api.from("expenses").insert({
      company_id: profile?.company_id,
      category: values.category, amount: values.amount, spent_at: values.spent_at,
      note: values.note || null, created_by: user?.uid, replaces_id: editTarget.id,
    });
    if (iErr) return toast.error(iErr.message);
    
    const inserted = Array.isArray(insertedList) ? insertedList[0] : insertedList;
    if (inserted) {
      await logAudit({
        entity_type: "expense", entity_id: inserted.id, action: "replace",
        note: editReason.trim(), before: editTarget, after: { ...values, replaces_id: editTarget.id },
      });
    }
    toast.success("Expense corrected");
    setEditTarget(null);
    setEditReason("");
    load();
  }

  async function submitRecurring(values: z.infer<typeof recSchema>) {
    const ok = await confirmSave({
      title: "Save recurring expense?",
      summary: `${values.category} · ${formatMoney(values.amount, settings)} (${values.frequency}).`,
    });
    if (!ok) return;
    setRecLoading(true);
    const { data: { user } } = await api.auth.getUser();
    const { error } = await api.from("recurring_expenses").insert({
      company_id: profile?.company_id,
      category: values.category,
      amount: values.amount,
      frequency: values.frequency,
      day_of_month: values.frequency === "monthly" ? values.day_of_month ?? 1 : null,
      day_of_week: values.frequency === "weekly" ? values.day_of_week ?? 0 : null,
      note: values.note || null,
      created_by: user?.uid,
    });
    setRecLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Recurring expense added");
    recForm.reset({ category: "Rent", amount: 0, frequency: "monthly", day_of_month: 1, day_of_week: 0, note: "" });
    setRecOpen(false);
    load();
  }

  async function postRecurring(t: any) {
    const { data: { user } } = await api.auth.getUser();
    const today = toISO(new Date());
    const { error } = await api.from("expenses").insert({
      company_id: profile?.company_id,
      category: t.category, amount: t.amount, spent_at: today,
      note: t.note ? `${t.note} (recurring)` : "Recurring", created_by: user?.uid,
    });
    if (error) return toast.error(error.message);
    await api.from("recurring_expenses").update({ last_posted_on: today }).eq("id", t.id);
    toast.success(`Posted ${t.category}`);
    load();
  }

  async function toggleActive(t: any) {
    await api.from("recurring_expenses").update({ active: !t.active }).eq("id", t.id);
    load();
  }

  async function deleteRecurring(t: any) {
    const { error } = await api.from("recurring_expenses").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  }

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(new Date());
  const monthStart = startOfMonth(new Date());

  const totals = useMemo(() => {
    let t = 0, w = 0, m = 0;
    for (const r of rows) {
      const d = startOfDay(new Date(r.spent_at));
      const a = Number(r.amount);
      if (+d === +today) t += a;
      if (d >= weekStart) w += a;
      if (d >= monthStart) m += a;
    }
    return { today: t, week: w, month: m, count: rows.length };
  }, [rows]);

  const inPeriod = (d: Date, p: Period) => {
    if (p === "all") return true;
    if (p === "today") return +d === +today;
    if (p === "week") return d >= weekStart;
    return d >= monthStart;
  };

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const d = startOfDay(new Date(r.spent_at));
      if (!inPeriod(d, chartPeriod)) continue;
      map.set(r.category, (map.get(r.category) ?? 0) + Number(r.amount));
    }
    return Array.from(map, ([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [rows, chartPeriod]);

  const chartTotal = chartData.reduce((s, d) => s + d.amount, 0);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]
  );

  const filtered = useMemo(() => rows.filter((r) => {
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    return inPeriod(startOfDay(new Date(r.spent_at)), period);
  }), [rows, categoryFilter, period]);

  const filteredTotal = filtered.reduce((s, r) => s + Number(r.amount), 0);

  const recurringWithDue = useMemo(
    () => recurring.map((t) => ({ ...t, _next: nextDueDate(t) })), [recurring]
  );
  const dueTemplates = recurringWithDue.filter((t) => t.active && t._next <= today);

  async function postAllDue() {
    for (const t of dueTemplates) await postRecurring(t);
  }

  const BAR_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))"];

  if (pageLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Track and manage your spending</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> New expense</Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Spent today</p><p className="text-lg font-bold text-success">{formatMoney(totals.today, settings)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">This week</p><p className="text-lg font-bold">{formatMoney(totals.week, settings)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">This month</p><p className="text-lg font-bold">{formatMoney(totals.month, settings)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Entries</p><p className="text-lg font-bold">{totals.count}</p></Card>
      </div>

      {/* Spending breakdown chart */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div>
            <h2 className="text-lg font-semibold">Spending by category</h2>
            <p className="text-xs text-muted-foreground">Total: {formatMoney(chartTotal, settings)}</p>
          </div>
          <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as Period)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {chartData.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No expenses in this period.</p>
        ) : (
          <div style={{ width: "100%", height: Math.max(120, chartData.length * 36 + 20) }}>
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  formatter={(v: any) => formatMoney(Number(v), settings)}
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Recurring expenses */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4" />
            <h2 className="text-lg font-semibold">Recurring expenses</h2>
          </div>
          <div className="flex gap-2">
            {dueTemplates.length > 0 && (
              <Button size="sm" variant="secondary" onClick={postAllDue}>Post all due ({dueTemplates.length})</Button>
            )}
            <Button size="sm" onClick={() => setRecOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add</Button>
          </div>
        </div>
        {recurringWithDue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No recurring expenses yet. Add Rent, Salaries, Internet, etc.</p>
        ) : (
          <div className="grid gap-2">
            {recurringWithDue.map((t) => {
              const due = t.active && t._next <= today;
              const sched = t.frequency === "monthly"
                ? `Monthly on day ${t.day_of_month ?? 1}`
                : `Weekly on ${WEEKDAYS[t.day_of_week ?? 0]}`;
              return (
                <div key={t.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md border ${t.active ? "" : "opacity-60"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.category} · {formatMoney(t.amount, settings)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {sched} · Next: {toISO(t._next)}{due ? " · due" : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0 self-end sm:self-auto">
                    {t.active && (
                      <Button size="sm" variant={due ? "default" : "outline"} onClick={() => postRecurring(t)}>Post now</Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => toggleActive(t)} title={t.active ? "Pause" : "Resume"}>
                      {t.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => deleteRecurring(t)} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Period" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} · {formatMoney(filteredTotal, settings)}</span>
      </div>

      <div className="grid gap-2">
        {filtered.map((e) => (
          <Card key={e.id} className="p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 w-full max-w-full overflow-hidden">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{e.category} · {formatMoney(e.amount, settings)}</p>
              <p className="text-xs text-muted-foreground truncate">{e.spent_at}{e.note ? ` · ${e.note}` : ""}</p>
            </div>
            {isStaff && (
              <div className="flex gap-1 shrink-0 self-end sm:self-auto">
                <Button size="sm" variant="outline" onClick={() => openEdit(e)}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setVoidTarget(e); setVoidReason(""); }}>Void</Button>
              </div>
            )}
          </Card>
        ))}
        {filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground">No expenses match the filters.</Card>}
      </div>

      {/* New expense dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div><Label>Category</Label><Input placeholder="Transport, Airtime, Office…" {...form.register("category")} /></div>
            <div><Label>Amount</Label><Input type="number" {...form.register("amount")} />
              {form.formState.errors.amount && <p className="text-destructive text-xs mt-1">{form.formState.errors.amount.message}</p>}
            </div>
            <div><Label>Date</Label><Input type="date" {...form.register("spent_at")} /></div>
            <div><Label>Note</Label><Input {...form.register("note")} /></div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recurring dialog */}
      <Dialog open={recOpen} onOpenChange={setRecOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New recurring expense</DialogTitle></DialogHeader>
          <form onSubmit={recForm.handleSubmit(submitRecurring)} className="space-y-4">
            <div><Label>Category</Label><Input placeholder="Rent, Salaries, Internet…" {...recForm.register("category")} /></div>
            <div><Label>Amount</Label><Input type="number" {...recForm.register("amount")} />
              {recForm.formState.errors.amount && <p className="text-destructive text-xs mt-1">{recForm.formState.errors.amount.message}</p>}
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={recFreq} onValueChange={(v) => recForm.setValue("frequency", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recFreq === "monthly" ? (
              <div><Label>Day of month (1–28)</Label><Input type="number" min={1} max={28} {...recForm.register("day_of_month")} /></div>
            ) : (
              <div>
                <Label>Day of week</Label>
                <Select value={String(recForm.watch("day_of_week") ?? 0)} onValueChange={(v) => recForm.setValue("day_of_week", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Note</Label><Input {...recForm.register("note")} /></div>
            <Button type="submit" disabled={recLoading} className="w-full">
              {recLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Void confirm */}
      <Dialog open={!!voidTarget} onOpenChange={(o) => { if (!o) setVoidTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Void expense</DialogTitle></DialogHeader>
          {voidTarget && (
            <div className="space-y-3">
              <p className="text-sm">{voidTarget.category} · {formatMoney(voidTarget.amount, settings)} on {voidTarget.spent_at}</p>
              <div>
                <Label>Reason (required)</Label>
                <Textarea rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Why are you voiding this entry?" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setVoidTarget(null)}>Cancel</Button>
                <Button variant="destructive" onClick={voidExpense}>Void</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit (void+replace) */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit expense (void & replace)</DialogTitle></DialogHeader>
          <form onSubmit={editForm.handleSubmit(submitEdit)} className="space-y-4">
            <div><Label>Category</Label><Input {...editForm.register("category")} /></div>
            <div><Label>Amount</Label><Input type="number" {...editForm.register("amount")} /></div>
            <div><Label>Date</Label><Input type="date" {...editForm.register("spent_at")} /></div>
            <div><Label>Note</Label><Input {...editForm.register("note")} /></div>
            <div>
              <Label>Reason for change (required)</Label>
              <Textarea rows={2} value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="e.g. Wrong amount entered" />
            </div>
            <Button type="submit" className="w-full">Save correction</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
