import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { ClientPicker } from "@/components/ClientPicker";
import { calculateScore } from "@/lib/score";

export const LoanForm = ({ open, onOpenChange, pickClient, clientId, onCreated }: any) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [selectedClientId, setSelectedClientId] = useState(clientId || "");
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [durationMonths, setDurationMonths] = useState("");
  const [frequency, setFrequency] = useState("monthly");

  const [clientLoans, setClientLoans] = useState<any[]>([]);
  const targetClient = pickClient ? selectedClientId : clientId;

  useEffect(() => {
    if (!targetClient) {
      setClientLoans([]);
      return;
    }
    api.from("loans").select("*").eq("client_id", targetClient)
      .then(({ data }) => setClientLoans(data || []))
      .catch(console.error);
  }, [targetClient]);

  const scoreData = targetClient ? calculateScore(clientLoans) : null;
  const hasActiveLoan = clientLoans.some((l) => l.status === "active" || l.status === "approved" || l.status === "pending");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
              <ClientPicker value={selectedClientId} onChange={setSelectedClientId} />
            </div>
          )}

          {targetClient && scoreData && (
            <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground">AkiliScore:</span>
                <span className={`font-bold ${scoreData.color}`}>{scoreData.score} ({scoreData.text})</span>
              </div>
              
              {hasActiveLoan && (
                <div className="flex items-start gap-2 text-destructive bg-destructive/10 p-2 rounded">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p><strong>Warning:</strong> This client already has an active or pending loan. Giving multiple loans increases default risk.</p>
                </div>
              )}
              {scoreData.defaultedLoans > 0 && (
                <div className="flex items-start gap-2 text-destructive bg-destructive/10 p-2 rounded">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p><strong>Warning:</strong> This client has {scoreData.defaultedLoans} previously defaulted loan(s).</p>
                </div>
              )}
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