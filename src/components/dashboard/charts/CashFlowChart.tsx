import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "./ChartCard";
import { formatMoney } from "@/hooks/useSettings";

export const CashFlowChart = ({ range, mode, loans, payments, expenses }: any) => {
  const data = useMemo(() => {
    // Generate daily buckets for the range
    const buckets = new Map();
    let current = new Date(range.from);
    const end = new Date(range.to);
    
    while (current <= end) {
      buckets.set(current.toISOString().slice(0, 10), { date: current.toISOString().slice(0, 10), in: 0, out: 0 });
      current.setDate(current.getDate() + 1);
    }

    payments.forEach((p: any) => {
      const d = p.paid_at.slice(0, 10);
      if (buckets.has(d)) {
        buckets.get(d).in += Number(p.amount);
      }
    });

    loans.forEach((l: any) => {
      if (l.disbursed_at) {
        const d = l.disbursed_at.slice(0, 10);
        if (buckets.has(d)) {
          buckets.get(d).out += Number(l.principal) - (Number(l.charge) || 0);
        }
      }
    });

    expenses.forEach((e: any) => {
      const d = e.spent_at.slice(0, 10);
      if (buckets.has(d)) {
        buckets.get(d).out += Number(e.amount);
      }
    });

    return Array.from(buckets.values());
  }, [range, loans, payments, expenses]);

  return (
    <ChartCard title="Cash Flow" subtitle="Money in vs Money out">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={v => v > 1000 ? `${v/1000}k` : v} tick={{ fontSize: 12, fill: '#6b7280' }} width={45} />
            <Tooltip 
              formatter={(val: number) => formatMoney(val)}
              labelFormatter={(l) => `Date: ${l}`}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Area type="monotone" dataKey="in" name="Cash In" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIn)" />
            <Area type="monotone" dataKey="out" name="Cash Out" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorOut)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};