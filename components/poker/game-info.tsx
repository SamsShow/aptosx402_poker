"use client";

import { useGameStore } from "@/lib/store/game-store";
import { formatAddress } from "@/lib/utils";
import { ExternalLink, Copy, CheckCircle, Gamepad2, Play, Square, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface GameInfoProps {
  gameId?: string;
}

export function GameInfo({ gameId }: GameInfoProps) {
  const { gameState, isConnected } = useGameStore();
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  if (!gameState) {
    return (
      <div className="comic-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-comic-orange comic-border flex items-center justify-center">
            <Gamepad2 className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-comic text-xl">GAME INFO</h3>
        </div>
        <p className="text-muted-foreground font-bold">No game in progress</p>
      </div>
    );
  }
  
  const copyGameId = async () => {
    await navigator.clipboard.writeText(gameState.gameId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = async () => {
    if (!gameId) return;
    
    setIsStarting(true);
    try {
      // Start the game loop - it will handle starting hands automatically
      const res = await fetch(`/api/game/${gameId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnDelay: 3000, // 3 seconds between turns
          handDelay: 5000, // 5 seconds between hands
          maxHands: 100,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setIsRunning(true);
      }
    } catch (error) {
      console.error("Failed to start game:", error);
    } finally {
      setIsStarting(false);
    }
  };

  const stopGame = async () => {
    if (!gameId) return;
    
    setIsStopping(true);
    try {
      const res = await fetch(`/api/game/${gameId}/run`, {
        method: "DELETE",
      });
      
      const data = await res.json();
      if (data.success) {
        setIsRunning(false);
      }
    } catch (error) {
      console.error("Failed to stop game:", error);
    } finally {
      setIsStopping(false);
    }
  };
  
  return (
    <div className="comic-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-comic-orange comic-border flex items-center justify-center">
            <Gamepad2 className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-comic text-xl">GAME INFO</h3>
        </div>
        <div className={`comic-badge px-2 py-1 text-xs text-white ${
          isConnected ? "bg-comic-green" : "bg-comic-red"
        }`}>
          {isConnected ? "LIVE!" : "OFFLINE"}
        </div>
      </div>
      
      {/* Game ID */}
      <div className="mb-4">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Game ID
        </label>
        <div className="flex items-center gap-2 mt-1">
          <code className="text-sm font-mono bg-muted px-3 py-2 border-2 border-foreground flex-1 truncate">
            {formatAddress(gameState.gameId, 8)}
          </code>
          <button 
            onClick={copyGameId}
            className="w-10 h-10 comic-border bg-comic-blue flex items-center justify-center comic-btn text-white"
          >
            {copied ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Game Controls */}
      <div className="mb-4">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">
          Game Controls
        </label>
        <div className="flex gap-2">
          {!isRunning ? (
            <Button
              variant="call"
              size="sm"
              className="flex-1 gap-2"
              onClick={startGame}
              disabled={isStarting}
            >
              {isStarting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {gameState.stage === "waiting" ? "Start Game" : "Resume Game"}
            </Button>
          ) : (
            <Button
              variant="fold"
              size="sm"
              className="flex-1 gap-2"
              onClick={stopGame}
              disabled={isStopping}
            >
              {isStopping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Stop Game
            </Button>
          )}
        </div>
        {isRunning && (
          <p className="text-xs text-comic-green font-bold mt-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-comic-green rounded-full animate-pulse" />
            Game loop running...
          </p>
        )}
      </div>
      
      {/* Divider */}
      <div className="h-1 bg-foreground my-4" />
      
      {/* Game stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat label="Hand" value={`#${gameState.handNumber}`} />
        <Stat label="Stage" value={formatStage(gameState.stage)} highlight />
        <Stat label="Pot" value={`$${gameState.pot}`} color="comic-green" />
        <Stat label="Current Bet" value={`$${gameState.currentBet}`} color="comic-orange" />
        <Stat label="Small Blind" value={`$${gameState.smallBlind}`} />
        <Stat label="Big Blind" value={`$${gameState.bigBlind}`} />
      </div>
      
      {/* Divider */}
      <div className="h-1 bg-foreground my-4" />
      
      {/* Players */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Players ({gameState.players.filter(p => !p.folded).length}/{gameState.players.length} active)
        </label>
        <div className="mt-2 space-y-2">
          {gameState.players.map((player, index) => (
            <div 
              key={player.id}
              className={`flex items-center justify-between text-sm p-2 border-2 border-foreground ${
                player.isTurn ? "bg-comic-yellow comic-shadow" :
                player.folded ? "opacity-50 bg-muted" : "bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 border-2 border-foreground ${
                  player.isTurn ? "bg-comic-green" :
                  player.folded ? "bg-comic-red" : "bg-muted"
                }`} />
                <span className="font-bold uppercase">{player.name}</span>
                {player.isDealer && (
                  <span className="comic-badge bg-comic-yellow text-foreground px-1.5 py-0 text-[10px]">
                    D
                  </span>
                )}
              </div>
              <span className={`font-comic text-lg ${
                player.stack > 500 ? "text-comic-green" : 
                player.stack > 100 ? "text-comic-orange" : "text-comic-red"
              }`}>
                ${player.stack}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Divider */}
      <div className="h-1 bg-foreground my-4" />
      
      {/* View on explorer link */}
      <a 
        href={`https://explorer.aptoslabs.com/account/${gameState.gameId}?network=testnet`}
        target="_blank"
        rel="noopener noreferrer"
        className="comic-btn bg-comic-blue text-white px-4 py-2 flex items-center justify-center gap-2 w-full"
      >
        <span className="font-comic">VIEW ON EXPLORER</span>
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}

function Stat({ 
  label, 
  value, 
  highlight = false,
  color
}: { 
  label: string; 
  value: string; 
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className="bg-muted p-2 border-2 border-foreground">
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className={`font-comic text-lg ${color ? `text-${color}` : highlight ? "text-comic-purple" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function formatStage(stage: string): string {
  const names: Record<string, string> = {
    waiting: "WAITING",
    preflop: "PRE-FLOP",
    flop: "FLOP",
    turn: "TURN",
    river: "RIVER",
    showdown: "SHOWDOWN",
    settled: "COMPLETE",
  };
  return names[stage] || stage.toUpperCase();
}
