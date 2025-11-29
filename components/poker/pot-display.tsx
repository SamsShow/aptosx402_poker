"use client";

import { motion, AnimatePresence } from "framer-motion";
import { formatChips } from "@/lib/utils";

interface PotDisplayProps {
  pot: number;
}

export function PotDisplay({ pot }: PotDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Chip stack visualization */}
      <div className="flex items-end gap-1">
        {getChipStacks(pot).map((stack, i) => (
          <motion.div
            key={i}
            className="flex flex-col-reverse items-center"
            initial={{ opacity: 0, y: -20, rotate: 45 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 200 }}
          >
            {Array.from({ length: Math.min(stack.count, 5) }).map((_, j) => (
              <div
                key={j}
                className="w-5 h-2 -mb-1 border-2 border-foreground rounded-sm"
                style={{ backgroundColor: stack.color }}
              />
            ))}
          </motion.div>
        ))}
      </div>
      
      {/* Pot amount - Comic Style */}
      <AnimatePresence mode="wait">
        <motion.div
          key={pot}
          className="pot-display px-6 py-2"
          initial={{ scale: 0.5, opacity: 0, rotate: -5 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          <span className="text-xl">
            POT: <span className="text-comic-green">${formatChips(pot)}</span>
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

interface ChipStack {
  color: string;
  count: number;
}

function getChipStacks(amount: number): ChipStack[] {
  const stacks: ChipStack[] = [];
  let remaining = amount;
  
  // Chip denominations and colors (comic colors)
  const denominations = [
    { value: 500, color: "hsl(270, 70%, 60%)" },  // Purple
    { value: 100, color: "hsl(0, 0%, 15%)" },     // Black
    { value: 25, color: "hsl(142, 76%, 45%)" },   // Green
    { value: 5, color: "hsl(350, 89%, 60%)" },    // Red
    { value: 1, color: "hsl(0, 0%, 95%)" },       // White
  ];
  
  for (const denom of denominations) {
    const count = Math.floor(remaining / denom.value);
    if (count > 0) {
      stacks.push({ color: denom.color, count: Math.min(count, 10) });
      remaining = remaining % denom.value;
    }
  }
  
  // Always show at least one chip
  if (stacks.length === 0 && amount > 0) {
    stacks.push({ color: "hsl(0, 0%, 95%)", count: 1 });
  }
  
  return stacks;
}
