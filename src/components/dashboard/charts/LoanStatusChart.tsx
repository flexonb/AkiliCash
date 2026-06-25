import React, { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartCard } from "./ChartCard";
import { formatMoney } from "@/hooks/useSettings";

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

export const LoanStatusChart = ({ loans, mode }: any) => {
  const data = useMemo(() => {
    let active = 0, completed = 0, defaulted = 0, pending = 0;

    loans.forEach((l: any) => {
      const val = mode === "amount" ? Number(l.total_repayable) : 1;
      if (l.status === "active") active += val;
      else if (l.status === "completed") completed += val;
      else if (l.status === "defaulted") defaulted += val;
      else pending += val;
    });

    return [
      { name: 'Active', value: active },
      { name: 'Pending', value: pending },
      { name: 'Defaulted', value: defaulted },
      { name: 'Completed', value: completed },
    ].filter(d => d.value > 0);
  }, [loans, mode]);

  return (
    <ChartCard title="Loan Portfolio Status" subtitle={`By ${mode}`}>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val: number) => mode === "amount" ? formatMoney(val) : val} />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};