import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const PaymentForm = ({ open, onOpenChange, loanId, loanOptions, maxAmount, onCreated }: any) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedLoanId, setSelectedLoanId] = useState(loanId || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    const targetLoan = loanId || selectedLoanId;
    if (!targetLoan) {
      toast.error("Please select a loan");
      return;
    }

    setLoading(true);
    try {
      const { error } = await api.from("payments").insert({
        loan_id: targetLoan,
        company_id: profile.company_id,
        amount: Number(amount),
        payment_method: method,
        reference_number: reference,
        notes,
        created_by: user.uid,
        paid_at: new Date().toISOString()
      });

      if (error) throw error;
      
      toast.success("Payment recorded successfully");
      onOpenChange(false);
      setAmount("");
      setReference("");
      setNotes("");
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a new payment from the client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!loanId && loanOptions && (
            <div className="space-y-2">
              <Label>Select Loan</Label>
              <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a loan" />
                </SelectTrigger>
                <SelectContent>
                  {loanOptions.map((lo: any) => (
                    <SelectItem key={lo.id} value={lo.id}>
                      {lo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input 
              id="amount"
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              max={maxAmount}
              required
            />
            {maxAmount && <p className="text-xs text-muted-foreground">Max amount: {maxAmount}</p>}
          </div>
          
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference Number (Optional)</Label>
            <Input 
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. MOMO Txn ID"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea 
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !amount}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};