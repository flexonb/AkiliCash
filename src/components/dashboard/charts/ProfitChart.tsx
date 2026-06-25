import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "./ChartCard";
import { formatMoney } from "@/hooks/useSettings";

export const ProfitChart = ({ range, loans, payments, expenses }: any) => {
  const data = useMemo(() => {
    const buckets = new Map();
    let current = new Date(range.from);
    const end = new Date(range.to);
    
    while (current <= end) {
      buckets.set(current.toISOString().slice(0, 10), { date: current.toISOString().slice(0, 10), profit: 0 });
      current.setDate(current.getDate() + 1);
    }

    loans.forEach((l: any) => {
      if (l.disbursed_at) {
        const d = l.disbursed_at.slice(0, 10);
        if (buckets.has(d)) {
          buckets.get(d).profit += Number(l.charge) || 0;
        }
      }
    });

    expenses.forEach((e: any) => {
      const d = e.spent_at.slice(0, 10);
      if (buckets.has(d)) {
        buckets.get(d).profit -= Number(e.amount);
      }
    });

    return Array.from(buckets.values());
  }, [range, loans, expenses]);

  return (
    <ChartCard title="Daily Profitability" subtitle="Fees collected minus Expenses">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={v => v > 1000 ? `${v/1000}k` : v} tick={{ fontSize: 12, fill: '#6b7280' }} width={45} />
            <Tooltip 
              formatter={(val: number) => formatMoney(val)}
              labelFormatter={(l) => `Date: ${l}`}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="profit" name="Net Profit">
              {data.map((entry, index) => (
                <cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};