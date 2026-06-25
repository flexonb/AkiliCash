import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export interface CompanySettings {
  business_name: string;
  currency_symbol: string;
  currency_code: string;
  receipt_footer?: string;
  grace_period_days?: number;
}

export const useSettings = () => {
  const { profile, userType } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!profile) {
      if (mounted) setLoading(false);
      return;
    }
    
    // For clients, we could load the company settings if needed, but for now fallback
    const companyId = profile.company_id || profile.id; // profile.id is companyId for admins usually
    
    api.from("settings").eq("id", companyId).maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (data) {
          setSettings(data as CompanySettings);
        } else {
          // Fallback settings if none found
          setSettings({
            business_name: "AkiliCash",
            currency_symbol: "FRW",
            currency_code: "RWF",
            grace_period_days: 0
          });
        }
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSettings({
          business_name: "AkiliCash",
          currency_symbol: "FRW",
          currency_code: "RWF",
          grace_period_days: 0
        });
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [profile]);

  return { 
    settings: settings || {
      business_name: "AkiliCash",
      currency_symbol: "FRW",
      currency_code: "RWF",
      grace_period_days: 0
    }, 
    loading 
  };
};

export const formatMoney = (v: any, settings?: any) => {
  const num = Number(v);
  if (isNaN(num)) return String(v);
  const symbol = settings?.currency_symbol || "FRW";
  return `${symbol} ${num.toLocaleString()}`;
};
