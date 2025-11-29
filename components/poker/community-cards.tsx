"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Card, GameStage } from "@/types";
import { PlayingCard } from "./playing-card";

interface CommunityCardsProps {
  cards: Card[];
  stage: GameStage;
}

export function CommunityCards({ cards, stage }: CommunityCardsProps) {
  // Determine which cards to show based on stage
  const visibleCount = getVisibleCardCount(stage);
  
  return (
    <div className="flex items-center justify-center gap-2">
      <AnimatePresence mode="popLayout">
        {[0, 1, 2, 3, 4].map((index) => {
          const card = cards[index];
          const isVisible = index < visibleCount;
          
          if (!isVisible) {
            return null;
          }
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -50, rotateY: 180 }}
              animate={{ opacity: 1, y: 0, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ 
                duration: 0.5, 
                delay: getCardDelay(index, stage),
                type: "spring",
                stiffness: 100,
              }}
            >
              <PlayingCard
                card={card}
                size="md"
                faceDown={!card}
                animate={false}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
      
      {/* Placeholders for remaining cards */}
      {visibleCount < 5 && stage !== "waiting" && stage !== "preflop" && (
        <div className="flex gap-2 opacity-30">
          {Array.from({ length: 5 - visibleCount }).map((_, i) => (
            <div 
              key={`placeholder-${i}`}
              className="w-14 h-20 border-2 border-dashed border-foreground/50 bg-white/50"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getVisibleCardCount(stage: GameStage): number {
  switch (stage) {
    case "waiting":
    case "preflop":
      return 0;
    case "flop":
      return 3;
    case "turn":
      return 4;
    case "river":
    case "showdown":
    case "settled":
      return 5;
    default:
      return 0;
  }
}

function getCardDelay(index: number, stage: GameStage): number {
  // Stagger the card reveal animation
  if (stage === "flop" && index < 3) {
    return index * 0.15;
  }
  return 0;
}
