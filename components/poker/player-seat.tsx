"use client";

import { motion } from "framer-motion";
import type { Player } from "@/types";
import { cn, formatChips } from "@/lib/utils";
import { AGENT_CONFIGS } from "@/types/agents";
import { PlayingCard } from "./playing-card";
import { ChipStack } from "./chip-stack";

interface PlayerSeatProps {
  player: Player;
  isCurrentTurn: boolean;
  position: number;
}

export function PlayerSeat({ player, isCurrentTurn, position }: PlayerSeatProps) {
  const config = AGENT_CONFIGS[player.model];
  const isBottom = position === 0;
  
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Cards (shown above for non-bottom positions) */}
      {!isBottom && (
        <div className="flex gap-1 mb-1 justify-center">
          {player.cards.length > 0 ? (
            player.cards.map((card, i) => (
              <PlayingCard
                key={i}
                card={player.folded ? undefined : card}
                size="sm"
                faceDown={!player.folded && position !== 0}
              />
            ))
          ) : (
            <>
              <PlayingCard size="sm" faceDown />
              <PlayingCard size="sm" faceDown />
            </>
          )}
        </div>
      )}
      
      {/* Avatar and info */}
      <div className={cn(
        "relative flex flex-col items-center w-full",
        isCurrentTurn && "animate-wiggle"
      )}>
        {/* Turn indicator - Comic burst */}
        {isCurrentTurn && (
          <motion.div
            className="absolute -inset-3 bg-comic-yellow border-3 border-foreground z-0"
            style={{
              clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"
            }}
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
        
        {/* Avatar - Comic style */}
        <div className={cn(
          "relative z-10 flex items-center justify-center",
          player.folded && "opacity-50 grayscale"
        )}>
          <div 
            className={cn(
              "w-14 h-14 comic-border flex items-center justify-center font-comic text-white text-lg",
              isCurrentTurn ? "border-4 comic-shadow-lg" : "comic-shadow"
            )}
            style={{ 
              backgroundColor: config?.color || "#666",
              borderColor: isCurrentTurn ? "hsl(var(--comic-green))" : "hsl(var(--border))"
            }}
          >
            {player.name.slice(0, 2).toUpperCase()}
          </div>
          
          {/* Dealer button */}
          {player.isDealer && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-comic-yellow comic-border flex items-center justify-center font-comic text-xs text-foreground z-20">
              D
            </div>
          )}
        </div>
        
        {/* Name and stack - Comic style */}
        <div className={cn(
          "mt-2 px-3 py-1.5 text-center w-full bg-white comic-border",
          isCurrentTurn ? "comic-shadow-lg bg-comic-yellow" : "comic-shadow"
        )}>
          <div className="text-xs font-bold uppercase truncate">
            {player.name}
          </div>
          <div className={cn(
            "font-comic text-lg",
            player.stack > 500 ? "text-comic-green" : 
            player.stack > 100 ? "text-comic-orange" : "text-comic-red"
          )}>
            ${formatChips(player.stack)}
          </div>
        </div>
        
        {/* Current bet */}
        {player.bet > 0 && !player.folded && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-10">
            <ChipStack amount={player.bet} />
          </div>
        )}
        
        {/* Status badges */}
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {player.folded && (
            <div className="comic-badge bg-comic-red text-white px-2 py-0.5 text-[10px] whitespace-nowrap">
              FOLD!
            </div>
          )}
          {player.isAllIn && (
            <div className="comic-badge bg-comic-orange text-white px-2 py-0.5 text-[10px] whitespace-nowrap">
              ALL-IN!
            </div>
          )}
          {player.lastAction && !player.folded && !player.isAllIn && (
            <div className="comic-badge bg-comic-blue text-white px-2 py-0.5 text-[10px] uppercase whitespace-nowrap">
              {player.lastAction.type}
              {player.lastAction.amount > 0 && ` $${player.lastAction.amount}`}
            </div>
          )}
        </div>
      </div>
      
      {/* Cards (shown below for bottom position - player's own cards) */}
      {isBottom && (
        <div className="flex gap-2 mt-6 justify-center">
          {player.cards.length > 0 ? (
            player.cards.map((card, i) => (
              <PlayingCard
                key={i}
                card={player.folded ? undefined : card}
                size="md"
                faceDown={false}
              />
            ))
          ) : (
            <>
              <PlayingCard size="md" faceDown />
              <PlayingCard size="md" faceDown />
            </>
          )}
        </div>
      )}
    </div>
  );
}
