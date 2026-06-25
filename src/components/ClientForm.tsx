import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const ClientForm = ({ open, onOpenChange, onCreated }: any) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    setLoading(true);
    try {
      const { error } = await api.from("clients").insert({
        company_id: profile.company_id,
        full_name: fullName.trim(),
        national_id: nationalId.trim(),
        phone: phone.trim(),
        dob: dob,
        address: address.trim(),
        status: "active",
        created_by: user.uid
      });

      if (error) throw error;
      
      toast.success("Client created successfully");
      onOpenChange(false);
      setFullName("");
      setNationalId("");
      setPhone("");
      setDob("");
      setAddress("");
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create client");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
          <DialogDescription>
            Register a new client in the system.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c_fullName">Full Name</Label>
            <Input 
              id="c_fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="c_nationalId">National ID</Label>
              <Input 
                id="c_nationalId"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="119..."
                maxLength={16}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c_phone">Phone Number</Label>
              <Input 
                id="c_phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+250..."
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c_dob">Date of Birth</Label>
            <Input 
              id="c_dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c_address">Physical Address</Label>
            <Input 
              id="c_address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Kigali, Rwanda"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !fullName || !nationalId || !phone}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
