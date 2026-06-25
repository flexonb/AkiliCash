import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, UserCircle2, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
        const { data: compData, error: compErr } = await api.from("companies").insert({
          name: companyName,
          currency_code: "RWF",
          currency_symbol: "FRW"
        });
        
        if (compErr) throw compErr;

        const companyId = Array.isArray(compData) ? compData[0]?.id : compData?.id;
        if (!companyId) throw new Error("Failed to create company");

        // Create profile and settings in parallel
        await Promise.all([
          api.from("profiles").insert({
            id: user.uid || user.id,
            full_name: user.displayName || user.email?.split("@")[0] || "Admin",
            user_type: "company_admin",
            company_id: companyId,
          }),
          api.from("settings").insert({
            id: companyId,
            business_name: companyName,
            currency_code: "RWF",
            currency_symbol: "FRW"
          })
        ]);

      } else {
        if (!nationalId || !fullName) throw new Error("Full name and National ID required");
        // Create profile for client
        const { error: profErr } = await api.from("profiles").insert({
          id: user.uid || user.id,
          full_name: fullName,
          user_type: "client",
          national_id: nationalId
        });
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

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-3xl" />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
        }}
        className="w-full max-w-xl z-10"
      >
        <Card className="p-8 shadow-elegant border-muted/50 bg-card/80 backdrop-blur-xl">
          <div className="flex flex-col items-center text-center mb-8">
            <img src="/app-icon.png" alt="AkiliCash" className="w-16 h-16 rounded-2xl object-cover mb-4 shadow-sm" />
            <h1 className="text-3xl font-bold tracking-tight">Welcome to AkiliCash</h1>
            <p className="text-muted-foreground mt-2 text-balance">
              Let's get your account set up so you can start managing your finances.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!type ? (
              <motion.div
                key="selection"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="grid sm:grid-cols-2 gap-4"
              >
                <button 
                  onClick={() => setType("company")}
                  className="group p-6 text-left border rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Building2 className="w-10 h-10 mb-4 text-primary" />
                  <h3 className="font-semibold text-lg">Lending Company</h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">Manage loans, track clients, and process payments.</p>
                </button>
                <button 
                  onClick={() => setType("client")}
                  className="group p-6 text-left border rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <UserCircle2 className="w-10 h-10 mb-4 text-primary" />
                  <h3 className="font-semibold text-lg">Borrower</h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">View your loans and track your unified credit score.</p>
                </button>
              </motion.div>
            ) : type === "company" ? (
              <motion.div
                key="company-form"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-base">What is your company called?</Label>
                  <Input 
                    id="companyName"
                    value={companyName} 
                    onChange={e => setCompanyName(e.target.value)} 
                    placeholder="e.g. Akili Capital" 
                    className="h-12 text-lg px-4"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" size="lg" onClick={() => setType(null)} className="shrink-0" disabled={loading}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button size="lg" onClick={handleComplete} disabled={loading || !companyName} className="flex-1">
                    {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Complete Setup"}
                    {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="client-form"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Legal Name</Label>
                    <Input 
                      id="fullName"
                      value={fullName} 
                      onChange={e => setFullName(e.target.value)} 
                      placeholder="e.g. John Doe" 
                      className="h-12"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationalId">National ID</Label>
                    <Input 
                      id="nationalId"
                      value={nationalId} 
                      onChange={e => setNationalId(e.target.value)} 
                      placeholder="e.g. 119..." 
                      className="h-12 font-mono"
                    />
                    <p className="text-xs text-muted-foreground pt-1">
                      Your National ID securely links your credit history across the platform.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" size="lg" onClick={() => setType(null)} className="shrink-0" disabled={loading}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button size="lg" onClick={handleComplete} disabled={loading || !fullName || !nationalId} className="flex-1">
                    {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Complete Setup"}
                    {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
}
