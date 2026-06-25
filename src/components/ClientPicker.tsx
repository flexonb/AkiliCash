import React, { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

export const ClientPicker = ({ value, onChange }: any) => {
  const { profile } = useAuth();
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.company_id) {
      api.from("clients").select("id, full_name, national_id").eq("company_id", profile.company_id)
        .then(({ data }) => setClients(data || []));
    }
  }, [profile]);

  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Search or select client..." />
      </SelectTrigger>
      <SelectContent>
        {clients.map((c: any) => (
          <SelectItem key={c.id} value={c.id}>
            {c.full_name} ({c.national_id})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};