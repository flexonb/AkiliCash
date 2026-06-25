import { useState, useEffect } from "react";
export const useOutbox = () => {
  const [outboxCount, setOutboxCount] = useState(0);
  return outboxCount;
};