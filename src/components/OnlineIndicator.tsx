import React, { useState, useEffect } from "react";
import { isOffline, syncOutbox } from "@/lib/offline/sb";

export const OnlineIndicator = () => {
  const [offline, setOffline] = useState(isOffline);

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      syncOutbox();
    };
    const handleOffline = () => setOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-full shadow-lg text-sm font-medium z-50 flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
      Offline Mode
    </div>
  );
};

export const logAudit = () => {}; export const buildSchedule = () => []; export const allocatePayments = () => {}; export const generateDailyReport = () => {}; export const loadTableOffline = async () => []; export const formatMoney = (m:any) => m;