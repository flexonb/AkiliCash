import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/AppCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";

type Row = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  note: string | null;
  before: any;
  after: any;
  created_at: string;
};

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  update: "secondary",
  void: "destructive",
  replace: "default",
  delete: "destructive",
};

function entityLink(entity_type: string, entity_id: string): string | null {
  if (entity_type === "loan") return `/loans/${entity_id}`;
  if (entity_type === "client") return `/clients/${entity_id}`;
  return null;
}

export default function AuditLog() {
  const { isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [actors, setActors] = useState<Map<string, string>>(new Map());
  const [entity, setEntity] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await api
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      const list = (data ?? []) as Row[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.actor_id).filter(Boolean) as string[]));
      if (ids.length) {
        const { data: profs } = await api.from("profiles").select("id, full_name").in("id", ids);
        setActors(new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? p.id.slice(0, 8)])));
      }
    })();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (entity !== "all" && r.entity_type !== entity) return false;
      if (action !== "all" && r.action !== action) return false;
      if (term && !(r.note ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, entity, action, q]);

  if (loading) return <p>Loading…</p>;
  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Admins only.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Audit log</h1>
        <p className="text-muted-foreground">Every change to financial records.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            <SelectItem value="payment">Payments</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="loan">Loans</SelectItem>
            <SelectItem value="client">Clients</SelectItem>
            <SelectItem value="guarantor">Guarantors</SelectItem>
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="void">Void</SelectItem>
            <SelectItem value="replace">Replace</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
          </SelectContent>
        </Select>
        <Input className="w-56" placeholder="Search note…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} entries</span>
      </div>

      <div className="grid gap-2">
        {filtered.map((r) => {
          const isOpen = !!expanded[r.id];
          const link = entityLink(r.entity_type, r.entity_id);
          return (
            <Card key={r.id} className="p-3">
              <button
                type="button"
                className="w-full text-left flex items-start gap-2"
                onClick={() => setExpanded((m) => ({ ...m, [r.id]: !isOpen }))}
              >
                {isOpen ? <ChevronDown className="w-4 h-4 mt-1 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-1 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={ACTION_VARIANT[r.action] ?? "secondary"}>{r.action}</Badge>
                    <span className="text-sm font-medium capitalize">{r.entity_type}</span>
                    {link && (
                      <Link to={link} onClick={(e) => e.stopPropagation()} className="text-xs text-primary hover:underline">
                        view
                      </Link>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    by {r.actor_id ? actors.get(r.actor_id) ?? r.actor_id.slice(0, 8) : "—"}
                  </p>
                  {r.note && <p className="text-sm mt-1 italic">"{r.note}"</p>}
                </div>
              </button>
              {isOpen && (
                <div className="mt-3 pt-3 border-t grid md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="font-semibold mb-1">Before</p>
                    <pre className="bg-muted p-2 rounded overflow-auto max-h-60">{r.before ? JSON.stringify(r.before, null, 2) : "—"}</pre>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">After</p>
                    <pre className="bg-muted p-2 rounded overflow-auto max-h-60">{r.after ? JSON.stringify(r.after, null, 2) : "—"}</pre>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground">No entries match.</Card>}
      </div>
    </div>
  );
}
