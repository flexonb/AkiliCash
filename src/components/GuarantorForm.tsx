import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const GuarantorForm = ({ open, onOpenChange, clientId, onCreated }: any) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !clientId) return;
    
    setLoading(true);
    try {
      const { error } = await api.from("guarantors").insert({
        client_id: clientId,
        full_name: fullName,
        national_id: nationalId,
        phone,
        relation,
        company_id: profile.company_id
      });

      if (error) throw error;
      
      toast.success("Guarantor added successfully");
      onOpenChange(false);
      setFullName("");
      setNationalId("");
      setPhone("");
      setRelation("");
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to add guarantor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Guarantor</DialogTitle>
          <DialogDescription>
            Add a guarantor for this client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="g_fullName">Full Name</Label>
            <Input 
              id="g_fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Doe"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="g_nationalId">National ID</Label>
            <Input 
              id="g_nationalId"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              placeholder="119..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="g_phone">Phone Number</Label>
            <Input 
              id="g_phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+250..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="g_relation">Relationship to Client</Label>
            <Input 
              id="g_relation"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              placeholder="e.g. Sibling, Parent"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !fullName || !nationalId}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Guarantor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};