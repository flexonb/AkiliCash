import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const CloseDrawerDialog = ({ open, onOpenChange, session, onClosed }: any) => {
  const [loading, setLoading] = useState(false);
  const [actualClose, setActualClose] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    
    setLoading(true);
    try {
      const { error } = await api.from("drawer_sessions").update({
        closed_at: new Date().toISOString(),
        actual_close: Number(actualClose) || 0
      }).eq("id", session.id);

      if (error) throw error;
      
      toast.success("Drawer session closed successfully");
      onOpenChange(false);
      onClosed?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to close drawer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Drawer</DialogTitle>
          <DialogDescription>
            Record the actual cash you have in hand to close the session.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="actualClose">Actual Cash on Hand</Label>
            <Input 
              id="actualClose"
              type="number" 
              value={actualClose}
              onChange={(e) => setActualClose(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Close Session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};