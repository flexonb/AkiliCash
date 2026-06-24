import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/AppCard";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { ClientForm } from "@/components/ClientForm";

interface Client { id: string; full_name: string; phone: string; address: string | null; status: string; created_at: string }

type Filter = "all" | "active" | "dormant";

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("clients").select("*").order("full_name", { ascending: true });
    setClients((data ?? []) as Client[]);
  };

  useEffect(() => { load(); }, []);

  const filtered = clients
    .filter((c) => filter === "all" ? true : (c.status ?? "active") === filter)
    .filter((c) =>
      c.full_name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q)
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground">{clients.length} total</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> New client</Button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {(["all", "active", "dormant"] as Filter[]).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map((c) => {
          const dormant = (c.status ?? "active") === "dormant";
          return (
            <Link key={c.id} to={`/clients/${c.id}`}>
              <Card className={`p-4 hover:shadow-elegant transition-shadow ${dormant ? "opacity-70" : ""}`}>
                <div className="flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{c.full_name}</p>
                      {dormant && <Badge variant="secondary">Dormant</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{c.phone}{c.address ? ` · ${c.address}` : ""}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">No clients found.</Card>
        )}
      </div>

      <ClientForm open={open} onOpenChange={setOpen} onCreated={load} />
    </div>
  );
}
