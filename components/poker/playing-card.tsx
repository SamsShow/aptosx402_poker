"use client";

import { motion } from "framer-motion";
import type { Card } from "@/types";
import { cn } from "@/lib/utils";
import { SUIT_SYMBOLS, SUIT_COLORS } from "@/lib/poker/constants";

interface PlayingCardProps {
  card?: Card;
  size?: "sm" | "md" | "lg";
  faceDown?: boolean;
  className?: string;
  animate?: boolean;
}

const SIZES = {
  sm: { width: "w-9", height: "h-12", text: "text-xs", suit: "text-sm", shadow: "mb-1 mr-1" },
  md: { width: "w-14", height: "h-20", text: "text-base", suit: "text-xl", shadow: "mb-1.5 mr-1.5" },
  lg: { width: "w-18", height: "h-24", text: "text-lg", suit: "text-2xl", shadow: "mb-2 mr-2" },
};

export function PlayingCard({ 
  card, 
  size = "md", 
  faceDown = false,
  className,
  animate = true,
}: PlayingCardProps) {
  const sizeConfig = SIZES[size];
  
  if (faceDown || !card) {
    return (
      <div className={cn("relative", sizeConfig.shadow, className)}>
        <motion.div
          className={cn(
            "playing-card bg-comic-red relative overflow-hidden",
            sizeConfig.width,
            sizeConfig.height,
            "flex items-center justify-center"
          )}
          initial={animate ? { rotateY: 180, scale: 0.8 } : undefined}
          animate={animate ? { rotateY: 0, scale: 1 } : undefined}
          transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
        >
          {/* Pattern */}
          <div className="absolute inset-0 diagonal-stripes opacity-30" />
          <div className="font-comic text-black text-xs font-bold z-10">x402</div>
        </motion.div>
      </div>
    );
  }
  
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const suitColor = SUIT_COLORS[card.suit];
  
  return (
    <div className={cn("relative", sizeConfig.shadow, className)}>
      <motion.div
        className={cn(
          "playing-card bg-white flex flex-col p-1.5 relative overflow-hidden",
          sizeConfig.width,
          sizeConfig.height
        )}
        initial={animate ? { rotateY: -90, opacity: 0, scale: 0.8 } : undefined}
        animate={animate ? { rotateY: 0, opacity: 1, scale: 1 } : undefined}
        transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
      >
        {/* Top left corner */}
        <div className="flex flex-col items-start leading-none">
          <span 
            className={cn("font-comic font-bold", sizeConfig.text)}
            style={{ color: suitColor }}
          >
            {card.rank}
          </span>
          <span 
            className={cn(sizeConfig.suit)}
            style={{ color: suitColor }}
          >
            {suitSymbol}
          </span>
        </div>
        
        {/* Center suit */}
        <div className="flex-1 flex items-center justify-center">
          <span 
            className="text-3xl"
            style={{ color: suitColor }}
          >
            {suitSymbol}
          </span>
        </div>
        
        {/* Bottom right corner (rotated) */}
        <div className="flex flex-col items-end leading-none rotate-180">
          <span 
            className={cn("font-comic font-bold", sizeConfig.text)}
            style={{ color: suitColor }}
          >
            {card.rank}
          </span>
          <span 
            className={cn(sizeConfig.suit)}
            style={{ color: suitColor }}
          >
            {suitSymbol}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
