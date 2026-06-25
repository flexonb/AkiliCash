import React from "react";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

export const formatTel = (phone: string) => {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, '');
};

export const dialPhone = (phone: string) => {
  if (phone) {
    window.location.href = `tel:${formatTel(phone)}`;
  }
};

export const CallButton = ({ phone }: { phone?: string }) => {
  if (!phone) return null;
  return (
    <Button variant="outline" size="sm" onClick={() => dialPhone(phone)}>
      <Phone className="w-4 h-4 mr-2" />
      Call
    </Button>
  );
};