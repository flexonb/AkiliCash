import { Card } from "@/components/ui/AppCard";
import { ReactNode } from "react";

export function ChartCard({ title, subtitle, empty, children }: { title: string; subtitle?: string; empty?: boolean; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="h-64">
        {empty ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No data for selected period
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}
