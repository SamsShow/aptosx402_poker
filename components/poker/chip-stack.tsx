"use client";

import { motion } from "framer-motion";
import { formatChips } from "@/lib/utils";

interface ChipStackProps {
  amount: number;
  showLabel?: boolean;
}

export function ChipStack({ amount, showLabel = true }: ChipStackProps) {
  const chipColors = getChipColors(amount);
  
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Visual chip stack */}
      <motion.div 
        className="flex items-end gap-0.5"
        initial={{ opacity: 0, scale: 0.5, rotate: 45 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
      >
        {chipColors.map((color, i) => (
          <div key={i} className="flex flex-col-reverse">
            {Array.from({ length: Math.min(3, Math.ceil(amount / 100)) }).map((_, j) => (
              <div
                key={j}
                className="w-4 h-1.5 -mb-0.5 border border-foreground"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        ))}
      </motion.div>
      
      {/* Amount label - Comic style */}
      {showLabel && (
        <span className="text-[10px] font-comic text-white bg-foreground px-2 py-0.5 border-2 border-foreground">
          ${formatChips(amount)}
        </span>
      )}
    </div>
  );
}

function getChipColors(amount: number): string[] {
  const colors: string[] = [];
  
  // Comic-style chip colors
  if (amount >= 500) colors.push("hsl(270, 70%, 60%)"); // Purple
  if (amount >= 100) colors.push("hsl(0, 0%, 15%)");    // Black
  if (amount >= 25) colors.push("hsl(142, 76%, 45%)");  // Green
  if (amount >= 5) colors.push("hsl(350, 89%, 60%)");   // Red
  if (amount >= 1 || colors.length === 0) colors.push("hsl(0, 0%, 95%)"); // White
  
  return colors.slice(0, 3);
}
