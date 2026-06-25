import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const LoanForm = ({ open, onOpenChange, pickClient, clientId, onCreated }: any) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState(clientId || "");
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [durationMonths, setDurationMonths] = useState("");
  const [frequency, setFrequency] = useState("monthly");

  useEffect(() => {
    if (pickClient && profile?.company_id && open) {
      api.from("clients").select("id, full_name, national_id").eq("company_id", profile.company_id)
        .then(({ data }) => setClients(data || []));
    }
  }, [pickClient, profile, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    const targetClient = pickClient ? selectedClientId : clientId;
    if (!targetClient) {
      toast.error("Please select a client");
      return;
    }

    setLoading(true);
    try {
      const p = Number(principal);
      const r = Number(interestRate);
      const d = Number(durationMonths);
      
      const totalRepayable = p + (p * (r / 100) * d);

      const { error } = await api.from("loans").insert({
        client_id: targetClient,
        company_id: profile.company_id,
        principal: p,
        interest_rate: r,
        duration_months: d,
        payment_frequency: frequency,
        total_repayable: totalRepayable,
        status: "pending",
        start_date: new Date().toISOString().slice(0, 10),
        created_by: user.uid
      });

      if (error) throw error;
      
      toast.success("Loan application created");
      onOpenChange(false);
      
      // Reset form
      if (pickClient) setSelectedClientId("");
      setPrincipal("");
      setInterestRate("");
      setDurationMonths("");
      setFrequency("monthly");
      
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create loan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Loan Application</DialogTitle>
          <DialogDescription>
            Create a new loan record for a client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {pickClient && (
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} ({c.national_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="principal">Principal Amount</Label>
              <Input 
                id="principal"
                type="number" 
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestRate">Interest Rate (%) per month</Label>
              <Input 
                id="interestRate"
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="0.0"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (Months)</Label>
              <Input 
                id="duration"
                type="number"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                placeholder="1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !principal || !interestRate || !durationMonths}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Loan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};