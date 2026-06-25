export function calculateScore(loans: any[]) {
  if (!loans || loans.length === 0) {
    return {
      score: 0,
      text: "No History",
      color: "text-muted-foreground",
      activeLoans: 0,
      defaultedLoans: 0
    };
  }

  const completed = loans.filter((l) => l.status === "completed").length;
  const defaulted = loans.filter((l) => l.status === "defaulted").length;
  const active = loans.filter((l) => l.status === "active").length;

  let base = 650;
  base += completed * 20;
  base -= defaulted * 100;
  if (base > 850) base = 850;
  if (base < 300) base = 300;

  let text = "Fair";
  let color = "text-yellow-500";

  if (base >= 750) {
    text = "Excellent";
    color = "text-success";
  } else if (base >= 650) {
    text = "Good";
    color = "text-success";
  } else if (base < 550) {
    text = "Poor";
    color = "text-destructive";
  }

  return {
    score: base,
    text,
    color,
    activeLoans: active,
    defaultedLoans: defaulted
  };
}
