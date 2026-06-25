import React from "react";
export const PhotoCapture = ({ value, onChange, label }: any) => {
  return (
    <div className="border border-dashed p-4 text-center text-muted-foreground rounded">
      {label || "Photo Capture (Not implemented)"}
    </div>
  );
};