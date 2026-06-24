import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, UserCircle2, Loader2 } from "lucide-react";

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"company" | "client" | null>(null);

  // Form states
  const [companyName, setCompanyName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [fullName, setFullName] = useState("");

  async function handleComplete() {
    if (!user) return;
    setLoading(true);

    try {
      if (type === "company") {
        if (!companyName) throw new Error("Company name required");
        // Create company
        const { data: comp, error: compErr } = await api.from("companies").insert({
          name: companyName,
          currency_code: "RWF",
          currency_symbol: "FRW"
        }).select("id").single();
        if (compErr) throw compErr;

        // Create profile and settings in parallel
        const [profRes, settingsRes] = await Promise.all([
          api.from("profiles").insert({
            id: user.uid || user.id,
            full_name: user.displayName || user.email?.split("@")[0] || "Admin",
            user_type: "company_admin",
            company_id: comp.id,
          }),
          api.from("settings").insert({
            id: 1, // We'll need a better way to link settings in multi-company
            business_name: companyName,
            currency_code: "RWF",
            currency_symbol: "FRW"
          })
        ]);

        if (profRes.error) throw profRes.error;
        if (settingsRes.error) throw settingsRes.error;

      } else {
        if (!nationalId || !fullName) throw new Error("Full name and National ID required");
        // Create profile for client
        const { error: profErr } = await api.from("profiles").insert({
          id: user.uid || user.id,
          full_name: fullName,
          user_type: "client",
          national_id: nationalId
        }).select("id").single();
        if (profErr) throw profErr;
      }

      toast.success("Welcome to AkiliCash!");
      await refreshProfile();
      navigate("/");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="w-full max-w-xl p-8 shadow-elegant">
        <h1 className="text-3xl font-bold mb-2">Welcome to AkiliCash</h1>
        <p className="text-muted-foreground mb-8">How will you be using the platform?</p>

        {!type && (
          <div className="grid sm:grid-cols-2 gap-4">
            <button 
              onClick={() => setType("company")}
              className="p-6 text-left border rounded-xl hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Building2 className="w-8 h-8 mb-4 text-primary" />
              <h3 className="font-semibold text-lg">Lending Company</h3>
              <p className="text-sm text-muted-foreground mt-2">Manage loans, track clients, and process payments.</p>
            </button>
            <button 
              onClick={() => setType("client")}
              className="p-6 text-left border rounded-xl hover:border-primary hover:bg-primary/5 transition-all"
            >
              <UserCircle2 className="w-8 h-8 mb-4 text-primary" />
              <h3 className="font-semibold text-lg">Borrower</h3>
              <p className="text-sm text-muted-foreground mt-2">View your loans and track your unified credit score.</p>
            </button>
          </div>
        )}

        {type === "company" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <Label>Company Name</Label>
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Akili Capital" />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setType(null)}>Back</Button>
              <Button onClick={handleComplete} disabled={loading} className="flex-1">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create Company
              </Button>
            </div>
          </div>
        )}

        {type === "client" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <Label>Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" />
            </div>
            <div>
              <Label>National ID</Label>
              <Input value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="e.g. 119..." />
              <p className="text-xs text-muted-foreground mt-2">Your National ID links your credit history across all lending companies on AkiliCash.</p>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setType(null)}>Back</Button>
              <Button onClick={handleComplete} disabled={loading} className="flex-1">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create Profile
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
