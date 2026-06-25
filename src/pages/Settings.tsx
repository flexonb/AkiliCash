import { useEffect, useState } from "react";
import { z } from "zod";
import { useConfirmSave } from "@/components/ConfirmSave";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { phoneSchema } from "@/lib/phone";

type Role = "admin" | "staff";

interface TeamRow {
  user_id: string;
  role: Role;
  full_name: string | null;
}

const newUserSchema = z.object({
  full_name: z.string().trim().min(1).max(100),
  phone: phoneSchema,
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "At least 8 characters").max(100),
  role: z.enum(["admin", "staff"]),
});

export default function Settings() {
  const { profile, isAdmin, user } = useAuth();
  const confirmSave = useConfirmSave();
  const [loading, setLoading] = useState(false);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [form, setForm] = useState({ business_name: "AkiliCash", currency_code: "RWF", currency_symbol: "FRW", business_phone: "", business_email: "", business_address: "" });
  const [addOpen, setAddOpen] = useState(false);

  async function loadTeam() {
    // Fetch roles + join profile names manually to be safe across schema cache states
    const { data: roles } = await api.from("user_roles").select("user_id, role");
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    let nameById = new Map<string, string | null>();
    if (ids.length) {
      const { data: profiles } = await api.from("profiles").select("id, full_name").in("id", ids);
      nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    }
    setTeam((roles ?? []).map((r) => ({ user_id: r.user_id, role: r.role as Role, full_name: nameById.get(r.user_id) ?? null })));
  }

  useEffect(() => {
    (async () => {
      if (!profile?.company_id) return;
      const { data } = await api.from("settings").select("*").eq("id", profile.company_id).maybeSingle();
      if (data) setForm({ business_name: data.business_name, currency_code: data.currency_code, currency_symbol: data.currency_symbol, business_phone: (data as any).business_phone ?? "", business_email: (data as any).business_email ?? "", business_address: (data as any).business_address ?? "" });
      await loadTeam();
    })();
  }, [profile?.company_id]);

  async function save() {
    const ok = await confirmSave({ title: "Save settings?", summary: `Business: ${form.business_name} · ${form.currency_code} (${form.currency_symbol})` });
    if (!ok) return;
    setLoading(true);
    const { error } = await api.from("settings").update(form).eq("id", profile?.company_id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved. Reload to see changes everywhere.");
  }

  async function changeRole(row: TeamRow, newRole: Role) {
    if (newRole === row.role) return;
    if (newRole === "admin") {
      const { error } = await api.from("user_roles").insert({ user_id: row.user_id, role: "admin" });
      if (error) return toast.error(error.message);
    } else {
      // demote: remove admin role row
      const { error } = await api.from("user_roles").delete().eq("user_id", row.user_id).eq("role", "admin");
      if (error) return toast.error(error.message);
      // ensure staff exists
      const hasStaff = team.some((t) => t.user_id === row.user_id && t.role === "staff");
      if (!hasStaff) {
        await api.from("user_roles").insert({ user_id: row.user_id, role: "staff" });
      }
    }
    toast.success("Role updated");
    await loadTeam();
  }

  async function removeAccess(row: TeamRow) {
    if (row.user_id === user?.id) return toast.error("You cannot remove yourself.");
    const { error } = await api.from("user_roles").delete().eq("user_id", row.user_id);
    if (error) return toast.error(error.message);
    toast.success("Access revoked");
    await loadTeam();
  }

  // Group rows by user so we display one row per user with their highest role
  const grouped = Array.from(
    team.reduce((map, r) => {
      const existing = map.get(r.user_id);
      if (!existing) map.set(r.user_id, r);
      else if (r.role === "admin") map.set(r.user_id, r);
      return map;
    }, new Map<string, TeamRow>()).values()
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">{isAdmin ? "Configure your business and team." : "View only — admins can edit."}</p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Business</h2>
        <div><Label>Business name</Label><Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} disabled={!isAdmin} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Currency code</Label><Input value={form.currency_code} onChange={(e) => setForm({ ...form, currency_code: e.target.value.toUpperCase() })} disabled={!isAdmin} /></div>
          <div><Label>Currency symbol</Label><Input value={form.currency_symbol} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} disabled={!isAdmin} /></div>
        </div>
        <div>
          <Label>Business phone</Label>
          <Input type="tel" value={form.business_phone} onChange={(e) => setForm({ ...form, business_phone: e.target.value })} disabled={!isAdmin} placeholder="0701234567" />
        </div>
        <div>
          <Label>Business email</Label>
          <Input type="email" value={form.business_email} onChange={(e) => setForm({ ...form, business_email: e.target.value })} disabled={!isAdmin} placeholder="info@business.com" />
        </div>
        <div>
          <Label>Business address</Label>
          <Input value={form.business_address} onChange={(e) => setForm({ ...form, business_address: e.target.value })} disabled={!isAdmin} placeholder="Plot 1, Kampala" />
          <p className="text-[11px] text-muted-foreground mt-1">Used in document headers (receipts, daily reports).</p>
        </div>
        {isAdmin && (
          <Button onClick={save} disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save</Button>
        )}
      </Card>

      {isAdmin && (
        <Card className="p-6 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Audit log</h2>
            <p className="text-xs text-muted-foreground">Every change to financial records.</p>
          </div>
          <Button asChild variant="outline"><Link to="/audit">Open audit log</Link></Button>
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Team</h2>
          {isAdmin && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add user
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {isAdmin
            ? "Only admins can create new users. Promote staff to admin or revoke access here."
            : "Only admins can manage the team."}
        </p>

        <div className="space-y-2">
          {grouped.map((r) => (
            <div key={r.user_id} className="flex items-center justify-between border-b last:border-0 pb-2 gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.full_name ?? r.user_id.slice(0, 8)}</p>
                {r.user_id === user?.id && <p className="text-[10px] text-muted-foreground">You</p>}
              </div>
              {isAdmin ? (
                <>
                  <Select value={r.role} onValueChange={(v) => changeRole(r, v as Role)}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-destructive"
                    disabled={r.user_id === user?.id}
                    onClick={() => removeAccess(r)}
                    aria-label="Revoke access"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <span className="font-medium uppercase text-xs">{r.role}</span>
              )}
            </div>
          ))}
          {grouped.length === 0 && <p className="text-sm text-muted-foreground">No team members yet.</p>}
        </div>
      </Card>

      {isAdmin && (
        <AddUserDialog open={addOpen} onOpenChange={setAddOpen} onCreated={loadTeam} />
      )}
    </div>
  );
}

function AddUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof newUserSchema>>({
    resolver: zodResolver(newUserSchema),
    defaultValues: { full_name: "", phone: "", email: "", password: "", role: "staff" },
  });

  async function submit(values: z.infer<typeof newUserSchema>) {
    setSubmitting(true);
    const { data, error } = await api.functions.invoke("admin-create-user", { body: values });
    setSubmitting(false);
    if (error || (data && (data as any).error)) {
      return toast.error((data as any)?.error ?? error?.message ?? "Failed to create user");
    }
    toast.success("User created");
    form.reset();
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div>
            <Label>Full name</Label>
            <Input {...form.register("full_name")} />
            {form.formState.errors.full_name && <p className="text-destructive text-xs mt-1">{form.formState.errors.full_name.message}</p>}
          </div>
          <div>
            <Label>Phone</Label>
            <Input type="tel" inputMode="tel" maxLength={10} placeholder="0701234567" {...form.register("phone")} />
            {form.formState.errors.phone && <p className="text-destructive text-xs mt-1">{form.formState.errors.phone.message}</p>}
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-destructive text-xs mt-1">{form.formState.errors.email.message}</p>}
          </div>
          <div>
            <Label>Temporary password</Label>
            <Input type="text" {...form.register("password")} />
            <p className="text-[11px] text-muted-foreground mt-1">Share this with the user. They can change it later.</p>
            {form.formState.errors.password && <p className="text-destructive text-xs mt-1">{form.formState.errors.password.message}</p>}
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.watch("role")} onValueChange={(v) => form.setValue("role", v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create user
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
