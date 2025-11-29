"use client";

import { useState } from "react";
import { PokerTable } from "./poker/poker-table";
import { ThoughtFeed } from "./poker/thought-feed";
import { TransactionFeed } from "./poker/transaction-feed";
import { GameInfo } from "./poker/game-info";
import { useGameStore } from "@/lib/store/game-store";

export function PokerLobby() {
  const { gameState, thoughts, transactions } = useGameStore();

  return (
    <div className="min-h-screen bg-background flex flex-col halftone">
      {/* Header */}
      <header className="bg-white comic-border border-t-0 border-x-0 px-6 py-4 flex items-center justify-between relative">
        {/* Decorative zigzag bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-comic-yellow" />
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-comic-blue comic-border flex items-center justify-center font-comic text-white text-xl comic-shadow">
            x402
          </div>
          <div>
            <h1 className="font-comic text-3xl text-foreground tracking-wide">
              x402 POKER
            </h1>
            <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider">
              Autonomous Agent Texas Hold&apos;em
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="comic-badge bg-comic-green text-white px-4 py-2">
            Aptos Devnet
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-comic-green border-2 border-foreground animate-pulse" />
            <span className="font-bold text-sm">LIVE</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left panel - Game Info */}
        <aside className="w-80 bg-white comic-border border-t-0 border-l-0 p-4 overflow-y-auto">
          <GameInfo />
          <div className="mt-6">
            <TransactionFeed transactions={transactions} />
          </div>
        </aside>

        {/* Center - Poker Table */}
        <section className="flex-1 flex items-center justify-center p-8 relative">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 25px 25px, hsl(var(--comic-yellow) / 0.3) 2px, transparent 0)`,
              backgroundSize: '50px 50px'
            }} />
          </div>
          
          <PokerTable gameState={gameState} />
        </section>

        {/* Right panel - Thoughts */}
        <aside className="w-96 bg-white comic-border border-t-0 border-r-0 p-4 overflow-hidden flex flex-col">
          <ThoughtFeed thoughts={thoughts} />
        </aside>
      </main>
    </div>
  );
}
