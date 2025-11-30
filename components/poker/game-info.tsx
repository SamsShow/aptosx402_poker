"use client";

import { useGameStore } from "@/lib/store/game-store";
import { formatAddress } from "@/lib/utils";
import { ExternalLink, Copy, CheckCircle, Gamepad2, Play, Square, Loader2, Wallet, Coins, RefreshCw, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FundAgentModal } from "./fund-agent-modal";
import { PreGameFundingModal } from "./pre-game-funding";

interface PlayerBalance {
  id: string;
  name: string;
  address: string;
  currentStack: number;
  walletBalance: {
    octas: number;
    chips: number;
    apt: number;
    formatted: string;
  };
  hasSufficientFunds: boolean;
  needsFunding: boolean;
}

interface BalanceStatus {
  players: PlayerBalance[];
  summary: {
    totalPlayers: number;
    fundedPlayers: number;
    allFunded: boolean;
    canStartGame: boolean;
  };
  minRequired: {
    chips: number;
    octas: number;
    apt: number;
  };
}

interface GameInfoProps {
  gameId?: string;
}

export function GameInfo({ gameId }: GameInfoProps) {
  const { gameState, isConnected, setGameState } = useGameStore();
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [balanceStatus, setBalanceStatus] = useState<BalanceStatus | null>(null);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);
  
  // Fetch balance status for all players (with debouncing)
  const fetchBalanceStatus = useCallback(async () => {
    if (!gameId || gameState?.stage !== "waiting") return;
    
    try {
      const res = await fetch(`/api/game/${gameId}/sync-balances`);
      const data = await res.json();
      
      if (data.success) {
        setBalanceStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch balance status:", error);
    }
  }, [gameId, gameState?.stage]);
  
  // Fetch balance status on mount and when game state changes (debounced to avoid rate limits)
  useEffect(() => {
    if (!gameId || gameState?.stage !== "waiting") return;
    
    // Debounce: only fetch once per 10 seconds max to avoid rate limits
    const timeoutId = setTimeout(() => {
      fetchBalanceStatus();
    }, 10000); // 10 second debounce - prevents excessive API calls
    
    return () => clearTimeout(timeoutId);
  }, [gameId, gameState?.stage]); // Removed fetchBalanceStatus from deps to prevent infinite loops
  
  // Sync balances from wallets
  const syncBalances = async () => {
    if (!gameId) return;
    
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/game/${gameId}/sync-balances`, {
        method: "POST",
      });
      
      const data = await res.json();
      
      if (data.success) {
        setBalanceStatus({
          players: data.players.map((p: any) => ({
            ...p,
            walletBalance: {
              octas: p.newStack * 10000,
              chips: p.newStack,
              apt: p.walletBalanceApt,
              formatted: `${p.walletBalanceApt.toFixed(4)} APT`,
            },
            hasSufficientFunds: p.hasSufficientFunds,
            needsFunding: !p.hasSufficientFunds,
          })),
          summary: {
            totalPlayers: data.players.length,
            fundedPlayers: data.players.filter((p: any) => p.hasSufficientFunds).length,
            allFunded: data.canStartGame,
            canStartGame: data.canStartGame,
          },
          minRequired: data.validation?.minRequired ? {
            chips: data.validation.minRequired,
            octas: data.validation.minRequired * 10000,
            apt: (data.validation.minRequired * 10000) / 100_000_000,
          } : { chips: 100, octas: 1_000_000, apt: 0.01 },
        });
        
        // Update game state if returned
        if (data.gameState) {
          setGameState(data.gameState);
        }
      }
    } catch (error) {
      console.error("Failed to sync balances:", error);
    } finally {
      setIsSyncing(false);
    }
  };
  
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
    
    // Check if funding is needed
    if (balanceStatus && !balanceStatus.summary.allFunded) {
      setShowFundingModal(true);
      return;
    }
    
    setIsStarting(true);
    setFundingError(null);
    
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
      } else if (data.needsFunding) {
        // Funding required - show modal
        setFundingError(data.message || "Agents need funding before starting");
        setShowFundingModal(true);
      } else {
        setFundingError(data.error || "Failed to start game");
      }
    } catch (error) {
      console.error("Failed to start game:", error);
      setFundingError("Failed to start game");
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
    <div className="comic-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
      <div className="mb-6">
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

      {/* Funding Status - Only show in waiting state */}
      {gameState.stage === "waiting" && balanceStatus && (
        <div className="mb-6">
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">
            Funding Status
          </label>
          <div className={`p-3 border-2 border-foreground ${
            balanceStatus.summary.allFunded ? "bg-comic-green/10" : "bg-comic-orange/10"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">
                {balanceStatus.summary.fundedPlayers}/{balanceStatus.summary.totalPlayers} Agents Funded
              </span>
              {balanceStatus.summary.allFunded ? (
                <CheckCircle className="h-4 w-4 text-comic-green" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-comic-orange" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Min required: {balanceStatus.minRequired.apt.toFixed(4)} APT per agent
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 gap-2"
              onClick={syncBalances}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Sync Wallet Balances
            </Button>
          </div>
        </div>
      )}

      {/* Funding Error */}
      {fundingError && (
        <div className="mb-6 p-3 bg-comic-red/10 border-2 border-comic-red">
          <p className="text-comic-red text-sm font-bold">{fundingError}</p>
        </div>
      )}

      {/* Game Controls */}
      <div className="mb-6">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3 block">
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
          <p className="text-xs text-comic-green font-bold mt-3 flex items-center gap-1">
            <span className="w-2 h-2 bg-comic-green rounded-full animate-pulse" />
            Game loop running...
          </p>
        )}
      </div>

      {/* Pre-game Funding Modal */}
      <PreGameFundingModal
        open={showFundingModal}
        onOpenChange={setShowFundingModal}
        buyIn={balanceStatus?.minRequired.chips || 100}
        onStartGame={async () => {
          // Sync balances first, then start game
          await syncBalances();
          setShowFundingModal(false);
          startGame();
        }}
        gameId={gameId}
      />
      
      {/* Divider */}
      <div className="h-1 bg-foreground my-6" />
      
      {/* Game stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Stat label="Hand" value={`#${gameState.handNumber}`} />
        <Stat label="Stage" value={formatStage(gameState.stage)} highlight />
        <Stat label="Pot" value={`$${gameState.pot}`} color="comic-green" />
        <Stat label="Current Bet" value={`$${gameState.currentBet}`} color="comic-orange" />
        <Stat label="Small Blind" value={`$${gameState.smallBlind}`} />
        <Stat label="Big Blind" value={`$${gameState.bigBlind}`} />
      </div>
      
      {/* Divider */}
      <div className="h-1 bg-foreground my-6" />
      
      {/* Players */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3 block">
          Players ({gameState.players.filter(p => !p.folded).length}/{gameState.players.length} active)
        </label>
        <div className="mt-3 space-y-3">
          {gameState.players.map((player, index) => {
            const playerBalance = balanceStatus?.players.find(p => p.id === player.id);
            const needsFunding = playerBalance?.needsFunding || (gameState.stage === "waiting" && player.stack < 100);
            
            return (
              <div 
                key={player.id}
                className={`text-sm p-2 border-2 border-foreground ${
                  player.isTurn ? "bg-comic-yellow comic-shadow" :
                  player.folded ? "opacity-50 bg-muted" : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
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
                    {player.stack} chips
                  </span>
                </div>
                {/* Show real APT balance if available */}
                {playerBalance && (
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-dashed">
                    <span className="text-xs text-muted-foreground">
                      Wallet: {playerBalance.walletBalance.apt.toFixed(4)} APT
                    </span>
                    {playerBalance.needsFunding ? (
                      <span className="text-xs text-comic-red font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Needs funding
                      </span>
                    ) : (
                      <span className="text-xs text-comic-green font-bold flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Funded
                      </span>
                    )}
                  </div>
                )}
                {/* Funding button integrated into player card */}
                {gameState.stage === "waiting" && (
                  <div className="mt-2 pt-2 border-t border-dashed">
                    <FundAgentModal
                      agentId={player.id}
                      walletAddress={player.address}
                      gameId={gameId}
                      onFundSuccess={async () => {
                        // Refresh balance status after funding
                        await syncBalances();
                        await fetchBalanceStatus();
                      }}
                    >
                      <Button
                        variant={needsFunding ? "poker" : "outline"}
                        size="sm"
                        className="w-full justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <Coins className="h-3 w-3 text-comic-yellow" />
                          <span className="font-bold text-xs">Fund {player.name}</span>
                        </div>
                        <Wallet className="h-3 w-3" />
                      </Button>
                    </FundAgentModal>
                  </div>
                )}
              </div>
            );
          })}
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
