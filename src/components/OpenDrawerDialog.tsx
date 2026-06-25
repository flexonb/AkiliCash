import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const OpenDrawerDialog = ({ open, onOpenChange, onOpened }: any) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    setLoading(true);
    try {
      const { error } = await api.from("drawer_sessions").insert({
        opened_by: user.uid,
        created_by: user.uid,
        company_id: profile.company_id,
        opening_balance: Number(openingBalance) || 0,
        opened_at: new Date().toISOString()
      });

      if (error) throw error;
      
      toast.success("Drawer session opened successfully");
      onOpenChange(false);
      onOpened?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to open drawer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open Drawer</DialogTitle>
          <DialogDescription>
            Start a new session to record payments, loans, and expenses.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openingBalance">Opening Balance (Cash on hand)</Label>
            <Input 
              id="openingBalance"
              type="number" 
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Open Session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};