"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { GameState } from "@/types";
import { PlayerSeat } from "./player-seat";
import { CommunityCards } from "./community-cards";
import { PotDisplay } from "./pot-display";
import { cn } from "@/lib/utils";

interface PokerTableProps {
  gameState: GameState | null;
}

// Seat positions around the oval table (5 players) - Better aligned
const SEAT_POSITIONS = [
  { top: "88%", left: "50%", transform: "translate(-50%, -50%)" }, // Bottom center (You)
  { top: "70%", left: "8%", transform: "translate(-50%, -50%)" },  // Bottom left
  { top: "12%", left: "12%", transform: "translate(-50%, -50%)" }, // Top left
  { top: "12%", left: "88%", transform: "translate(-50%, -50%)" }, // Top right
  { top: "70%", left: "92%", transform: "translate(-50%, -50%)" },  // Bottom right
];

export function PokerTable({ gameState }: PokerTableProps) {
  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="comic-card p-8 text-center">
          <h2 className="font-comic text-2xl text-comic-blue mb-2">NO GAME YET!</h2>
          <p className="text-muted-foreground font-bold">Waiting for action...</p>
          <div className="comic-loading mt-4">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto" style={{ aspectRatio: '16/10' }}>
      {/* Table background - Comic Style */}
      <div className="absolute inset-0 bg-comic-green rounded-[50%] comic-border border-[6px] comic-shadow-xl">
        {/* Inner pattern */}
        <div className="absolute inset-0 rounded-[50%] overflow-hidden">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at center, transparent 0%, hsl(var(--border) / 0.1) 100%)`,
            }}
          />
          {/* Halftone dots on table */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)`,
              backgroundSize: '16px 16px'
            }}
          />
        </div>
        
        {/* Inner rail */}
        <div className="absolute inset-6 rounded-[50%] border-4 border-foreground/30" />
        
        {/* Table logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
          <Image 
            src="/x402-logo.png" 
            alt="x402 Poker Logo" 
            width={200} 
            height={200}
            className="object-contain"
          />
        </div>
      </div>

      {/* Pot display - Better centered */}
      <div className="absolute top-[32%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <PotDisplay pot={gameState.pot} />
      </div>

      {/* Community cards - Better centered */}
      <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <CommunityCards 
          cards={gameState.communityCards} 
          stage={gameState.stage}
        />
      </div>

      {/* Player seats */}
      <AnimatePresence>
        {gameState.players.map((player, index) => (
          <motion.div
            key={player.id}
            className="absolute z-20 flex flex-col items-center"
            style={SEAT_POSITIONS[index]}
            initial={{ opacity: 0, scale: 0, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ 
              delay: index * 0.1,
              type: "spring",
              stiffness: 260,
              damping: 20
            }}
          >
            <PlayerSeat
              player={player}
              isCurrentTurn={index === gameState.currentPlayerIndex}
              position={index}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Stage indicator - Comic Style */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
        <motion.div 
          className={cn(
            "px-6 py-2 font-comic text-lg bg-comic-yellow text-foreground",
            "comic-border comic-shadow"
          )}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          key={gameState.stage}
        >
          {formatStage(gameState.stage)} • HAND #{gameState.handNumber}
        </motion.div>
      </div>
    </div>
  );
}

function formatStage(stage: string): string {
  const stageNames: Record<string, string> = {
    waiting: "WAITING",
    preflop: "PRE-FLOP",
    flop: "FLOP",
    turn: "TURN",
    river: "RIVER",
    showdown: "SHOWDOWN!",
    settled: "HAND COMPLETE",
  };
  return stageNames[stage] || stage.toUpperCase();
}
