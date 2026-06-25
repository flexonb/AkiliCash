import React from "react";
import { Button } from "@/components/ui/button";

export const DateRangeFilter = ({ range, onRangeChange, preset, onPresetChange }: any) => {
  const setPreset = (p: string) => {
    onPresetChange(p);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (p === "today") onRangeChange({ from: today, to: now });
    if (p === "7d") onRangeChange({ from: new Date(today.getTime() - 7 * 86400000), to: now });
    if (p === "30d") onRangeChange({ from: new Date(today.getTime() - 30 * 86400000), to: now });
    if (p === "this_month") onRangeChange({ from: new Date(now.getFullYear(), now.getMonth(), 1), to: now });
    if (p === "this_year") onRangeChange({ from: new Date(now.getFullYear(), 0, 1), to: now });
    if (p === "all") onRangeChange({ from: new Date(2020, 0, 1), to: now });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={preset === "today" ? "default" : "outline"} size="sm" onClick={() => setPreset("today")}>Today</Button>
      <Button variant={preset === "7d" ? "default" : "outline"} size="sm" onClick={() => setPreset("7d")}>7 days</Button>
      <Button variant={preset === "30d" ? "default" : "outline"} size="sm" onClick={() => setPreset("30d")}>30 days</Button>
      <Button variant={preset === "this_month" ? "default" : "outline"} size="sm" onClick={() => setPreset("this_month")}>This Month</Button>
      <Button variant={preset === "this_year" ? "default" : "outline"} size="sm" onClick={() => setPreset("this_year")}>This Year</Button>
      <Button variant={preset === "all" ? "default" : "outline"} size="sm" onClick={() => setPreset("all")}>All Time</Button>
    </div>
  );
};

export const formatTel = (t: string) => t;
export const dialPhone = (t: string) => { window.location.href = `tel:${t}`; };
