import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "./ChartCard";
import { formatMoney } from "@/hooks/useSettings";

export const RepaymentChart = ({ range, mode, loans, allPayments }: any) => {
  const data = useMemo(() => {
    // We look at all payments within the range
    const buckets = new Map();
    let current = new Date(range.from);
    const end = new Date(range.to);
    
    while (current <= end) {
      buckets.set(current.toISOString().slice(0, 10), { date: current.toISOString().slice(0, 10), collected: 0, expected: 0 });
      current.setDate(current.getDate() + 1);
    }

    // Expected logic could be complex depending on loan frequency. For simplicity, 
    // let's distribute expected repayments uniformly over the loan duration.
    loans.forEach((l: any) => {
      if (l.status === 'active' || l.status === 'completed' || l.status === 'defaulted') {
        const start = new Date(l.start_date);
        const dailyExpected = Number(l.total_repayable) / (Number(l.duration_months) * 30);
        
        let c = new Date(range.from);
        while (c <= end) {
          const d = c.toISOString().slice(0, 10);
          if (c >= start && (c.getTime() - start.getTime()) / (1000 * 3600 * 24) <= l.duration_months * 30) {
            buckets.get(d).expected += dailyExpected;
          }
          c.setDate(c.getDate() + 1);
        }
      }
    });

    allPayments.forEach((p: any) => {
      const d = p.paid_at.slice(0, 10);
      if (buckets.has(d)) {
        buckets.get(d).collected += Number(p.amount);
      }
    });

    return Array.from(buckets.values());
  }, [range, loans, allPayments]);

  return (
    <ChartCard title="Repayments vs Expected" subtitle="Daily collection tracking">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
             <defs>
              <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
            <Area type="monotone" dataKey="expected" name="Expected" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorExpected)" />
            <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};