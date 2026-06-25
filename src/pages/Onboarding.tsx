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

  // Form states - Company
  const [companyName, setCompanyName] = useState("");
  const [companyTin, setCompanyTin] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");

  // Form states - Client
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientDob, setClientDob] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  const validateCompany = () => {
    if (!companyName.trim()) throw new Error("Company name is required.");
    if (!companyTin.trim() || !/^\d{9}$/.test(companyTin.trim())) {
      throw new Error("TIN Number must be exactly 9 digits.");
    }
    if (!companyPhone.trim() || companyPhone.length < 10) {
      throw new Error("Please provide a valid company phone number.");
    }
    if (!companyAddress.trim()) throw new Error("Company address is required.");
  };

  const validateClient = () => {
    if (!fullName.trim()) throw new Error("Full Legal Name is required.");
    if (!nationalId.trim() || !/^\d{16}$/.test(nationalId.trim())) {
      throw new Error("National ID must be exactly 16 digits.");
    }
    if (!clientPhone.trim() || clientPhone.length < 10) {
      throw new Error("Please provide a valid phone number.");
    }
    if (!clientDob.trim()) {
      throw new Error("Date of birth is required.");
    }
    // Basic 18+ check
    const age = (new Date().getTime() - new Date(clientDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 18) {
      throw new Error("You must be at least 18 years old.");
    }
  };

  async function handleComplete() {
    if (!user) return;
    setLoading(true);

    try {
      if (type === "company") {
        validateCompany();
        // Create company
        const { data: compData, error: compErr } = await api.from("companies").insert({
          name: companyName.trim(),
          tin: companyTin.trim(),
          phone: companyPhone.trim(),
          email: companyEmail.trim() || user.email || null,
          address: companyAddress.trim(),
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
            phone: companyPhone.trim(),
          }),
          api.from("settings").insert({
            id: companyId,
            business_name: companyName.trim(),
            currency_code: "RWF",
            currency_symbol: "FRW"
          })
        ]);

      } else {
        validateClient();
        // Create profile for client
        const { error: profErr } = await api.from("profiles").insert({
          id: user.uid || user.id,
          full_name: fullName.trim(),
          user_type: "client",
          national_id: nationalId.trim(),
          phone: clientPhone.trim(),
          dob: clientDob,
          address: clientAddress.trim() || null
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
        <Card className="p-8 shadow-elegant border-muted/50 bg-card/80 backdrop-blur-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
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
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name <span className="text-destructive">*</span></Label>
                  <Input 
                    id="companyName"
                    value={companyName} 
                    onChange={e => setCompanyName(e.target.value)} 
                    placeholder="e.g. Akili Capital" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyTin">TIN Number <span className="text-destructive">*</span></Label>
                  <Input 
                    id="companyTin"
                    value={companyTin} 
                    onChange={e => setCompanyTin(e.target.value)} 
                    placeholder="e.g. 10xxxxxxx" 
                    className="font-mono"
                    maxLength={9}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Phone Number <span className="text-destructive">*</span></Label>
                    <Input 
                      id="companyPhone"
                      value={companyPhone} 
                      onChange={e => setCompanyPhone(e.target.value)} 
                      placeholder="+250..." 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Email Address</Label>
                    <Input 
                      id="companyEmail"
                      type="email"
                      value={companyEmail} 
                      onChange={e => setCompanyEmail(e.target.value)} 
                      placeholder="contact@company.com" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Physical Address <span className="text-destructive">*</span></Label>
                  <Input 
                    id="companyAddress"
                    value={companyAddress} 
                    onChange={e => setCompanyAddress(e.target.value)} 
                    placeholder="Kigali, Rwanda" 
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" size="lg" onClick={() => setType(null)} className="shrink-0" disabled={loading}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button size="lg" onClick={handleComplete} disabled={loading} className="flex-1">
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
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Legal Name <span className="text-destructive">*</span></Label>
                  <Input 
                    id="fullName"
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)} 
                    placeholder="e.g. John Doe" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationalId">National ID <span className="text-destructive">*</span></Label>
                  <Input 
                    id="nationalId"
                    value={nationalId} 
                    onChange={e => setNationalId(e.target.value)} 
                    placeholder="e.g. 119..." 
                    className="font-mono"
                    maxLength={16}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientPhone">Phone Number <span className="text-destructive">*</span></Label>
                    <Input 
                      id="clientPhone"
                      value={clientPhone} 
                      onChange={e => setClientPhone(e.target.value)} 
                      placeholder="+250..." 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientDob">Date of Birth <span className="text-destructive">*</span></Label>
                    <Input 
                      id="clientDob"
                      type="date"
                      value={clientDob} 
                      onChange={e => setClientDob(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientAddress">Physical Address</Label>
                  <Input 
                    id="clientAddress"
                    value={clientAddress} 
                    onChange={e => setClientAddress(e.target.value)} 
                    placeholder="Kigali, Rwanda" 
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" size="lg" onClick={() => setType(null)} className="shrink-0" disabled={loading}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button size="lg" onClick={handleComplete} disabled={loading} className="flex-1">
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

