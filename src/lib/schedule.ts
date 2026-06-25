import { addDays, addWeeks, addMonths, startOfDay, isBefore } from "date-fns";

export type Frequency = "daily" | "weekly" | "monthly" | "custom";

export interface ScheduleOpts {
  startDate: string;
  durationMonths: number;
  frequency: string | Frequency;
  gracePeriodDays?: number;
  totalRepayable: number;
}

export interface ScheduleItem {
  index: number;
  due: Date;
  amount: number;
}

export const buildSchedule = (opts: ScheduleOpts | any): { items: ScheduleItem[], firstDue: Date, finalDue: Date } => {
  if (!opts || typeof opts !== "object" || !opts.startDate) {
     return { items: [], firstDue: new Date(), finalDue: new Date() };
  }
  
  const { startDate, durationMonths, frequency, gracePeriodDays = 0, totalRepayable } = opts as ScheduleOpts;
  const start = startOfDay(new Date(startDate));
  
  let count = durationMonths;
  if (frequency === "daily") {
    count = Math.max(1, Math.round(durationMonths * 30)); 
  } else if (frequency === "weekly") {
    count = Math.max(1, Math.round(durationMonths * 4));
  }
  
  const items: ScheduleItem[] = [];
  const amt = totalRepayable / count;
  
  for (let i = 0; i < count; i++) {
    let d = start;
    if (frequency === "daily") d = addDays(d, i + 1);
    else if (frequency === "weekly") d = addWeeks(d, i + 1);
    else d = addMonths(d, i + 1);
    
    if (gracePeriodDays > 0) d = addDays(d, gracePeriodDays);
    
    items.push({ index: i + 1, due: d, amount: amt });
  }
  
  return {
    items,
    firstDue: items[0]?.due ?? start,
    finalDue: items[items.length - 1]?.due ?? start,
  };
};

export const allocatePayments = (items: ScheduleItem[], payments: any[]) => {
  const allocations: any[] = [];
  const paymentCovers: Record<string, number[]> = {};
  
  // Sort payments oldest first
  const pays = [...payments].sort((a, b) => +new Date(a.paid_at) - +new Date(b.paid_at));
  
  // Deep copy items to track remaining amounts
  const rem = items.map(it => ({ ...it, remaining: it.amount }));
  const today = startOfDay(new Date());
  
  for (const p of pays) {
    let pAmt = Number(p.amount);
    paymentCovers[p.id] = [];
    
    for (const it of rem) {
      if (pAmt <= 0) break;
      if (it.remaining <= 0) continue;
      
      if (pAmt >= it.remaining) {
        pAmt -= it.remaining;
        it.remaining = 0;
        paymentCovers[p.id].push(it.index);
        (it as any).closedAt = new Date(p.paid_at);
      } else {
        it.remaining -= pAmt;
        pAmt = 0;
        paymentCovers[p.id].push(it.index);
      }
    }
  }
  
  for (const it of rem) {
    let st = "pending";
    if (it.remaining <= 0) {
      const closedAt = (it as any).closedAt;
      if (closedAt && startOfDay(closedAt) > startOfDay(it.due)) {
        st = "paid_late";
      } else {
        st = "paid";
      }
    } else if (it.remaining < it.amount) {
      st = "partial";
    } else if (isBefore(it.due, today)) {
      st = "missed";
    }
    allocations.push({
      index: it.index,
      due: it.due,
      amount: it.amount,
      status: st,
      closedAt: (it as any).closedAt,
    });
  }
  
  return { allocations, paymentCovers };
};