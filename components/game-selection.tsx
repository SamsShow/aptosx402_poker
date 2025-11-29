"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { formatAddress } from "@/lib/utils";
import { 
  Play, 
  Plus, 
  RefreshCw, 
  Users, 
  Coins,
  Loader2,
  Gamepad2,
  User
} from "lucide-react";

interface GameSummary {
  gameId: string;
  stage: string;
  playerCount: number;
  pot: number;
  handNumber: number;
  createdAt?: number;
  creatorAddress?: string;
  players: {
    id: string;
    name: string;
    stack: number;
    folded: boolean;
  }[];
}

interface GameSelectionProps {
  onSelectGame: (gameId: string) => void;
  onCreateGame: (creatorAddress?: string) => Promise<string | null>;
}

// Maximum games to display in the lobby
const MAX_GAMES_DISPLAY = 20;

export function GameSelection({ onSelectGame, onCreateGame }: GameSelectionProps) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMounted = useRef(true);
  
  // Wallet connection
  const { connected, account } = useWallet();

  // Silent fetch that updates games without loading state
  const fetchGames = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    
    try {
      const res = await fetch("/api/game");
      const data = await res.json();
      
      if (!isMounted.current) return;
      
      if (data.success) {
        // Limit displayed games and sort by newest first
        const sortedGames = (data.games as GameSummary[])
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, MAX_GAMES_DISPLAY);
        
        setGames(sortedGames);
        setError(null);
      } else {
        // Only show error on initial load, not on refresh
        if (initialLoading) {
          setError(data.error || "Failed to fetch games");
        }
      }
    } catch (err) {
      if (!isMounted.current) return;
      // Only show error on initial load
      if (initialLoading) {
        setError(err instanceof Error ? err.message : "Failed to connect");
      }
    } finally {
      if (isMounted.current) {
        setInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [initialLoading]);

  useEffect(() => {
    isMounted.current = true;
    fetchGames();
    
    // Auto-refresh every 5 seconds (silent, no loading indicator)
    const interval = setInterval(() => fetchGames(false), 5000);
    
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchGames]);

  const handleCreateGame = async () => {
    setCreating(true);
    try {
      // Pass connected wallet address as creator
      const creatorAddress = connected ? account?.address?.toString() : undefined;
      const gameId = await onCreateGame(creatorAddress);
      if (gameId) {
        onSelectGame(gameId);
      }
    } finally {
      setCreating(false);
    }
  };

  // Manual refresh with indicator
  const handleManualRefresh = () => {
    fetchGames(true);
  };

  const formatStage = (stage: string): string => {
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
  };

  const getStageColor = (stage: string): string => {
    const colors: Record<string, string> = {
      waiting: "bg-comic-yellow",
      preflop: "bg-comic-blue",
      flop: "bg-comic-green",
      turn: "bg-comic-orange",
      river: "bg-comic-purple",
      showdown: "bg-comic-red",
      settled: "bg-muted",
    };
    return colors[stage] || "bg-muted";
  };

  return (
    <div className="min-h-screen bg-background halftone p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-16" /> {/* Spacer for centering */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-comic-blue comic-border flex items-center justify-center font-comic text-white text-2xl comic-shadow">
                x402
              </div>
            </div>
            <ConnectWalletButton />
          </div>
          <h1 className="font-comic text-5xl mb-2">GAME LOBBY</h1>
          <p className="text-muted-foreground font-bold">
            Select an active game or create a new one
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Button 
            variant="outline" 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          
          <Button 
            variant="call" 
            onClick={handleCreateGame}
            disabled={creating}
            className="gap-2"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create New Game
          </Button>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            className="comic-card bg-comic-red/10 border-comic-red p-4 mb-6"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <p className="text-comic-red font-bold">{error}</p>
          </motion.div>
        )}

        {/* Loading state - only on initial load */}
        {initialLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-comic-blue mx-auto mb-4" />
              <p className="font-bold text-muted-foreground">Loading games...</p>
            </div>
          </div>
        )}

        {/* Games list */}
        {!initialLoading && games.length === 0 && (
          <motion.div
            className="comic-card p-12 text-center"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Gamepad2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-comic text-2xl mb-2">NO ACTIVE GAMES</h3>
            <p className="text-muted-foreground font-bold mb-6">
              Create a new game to start playing
            </p>
            <Button 
              variant="call" 
              size="lg"
              onClick={handleCreateGame}
              disabled={creating}
              className="gap-2"
            >
              {creating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5" />
              )}
              Start New Game
            </Button>
          </motion.div>
        )}

        {!initialLoading && games.length > 0 && (
          <div className="space-y-4">
            {games.map((game, index) => (
              <motion.div
                key={game.gameId}
                className="comic-card p-6 hover:translate-x-1 hover:-translate-y-1 transition-transform cursor-pointer"
                onClick={() => onSelectGame(game.gameId)}
                initial={false}
                animate={{ opacity: 1 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-comic-purple comic-border flex items-center justify-center">
                      <Gamepad2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-comic text-xl">
                        GAME #{game.gameId.slice(-6).toUpperCase()}
                      </h3>
                      <p className="text-sm text-muted-foreground font-bold">
                        Hand #{game.handNumber} • {game.playerCount} players
                      </p>
                      {game.creatorAddress && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <User className="h-3 w-3" />
                          <span className="font-mono">
                            Created by {formatAddress(game.creatorAddress, 4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Stage badge */}
                    <div className={`comic-badge ${getStageColor(game.stage)} text-white px-3 py-1`}>
                      {formatStage(game.stage)}
                    </div>
                    
                    {/* Pot */}
                    <div className="flex items-center gap-2 bg-comic-yellow px-4 py-2 comic-border">
                      <Coins className="h-4 w-4" />
                      <span className="font-comic">${game.pot}</span>
                    </div>
                    
                    {/* Players count */}
                    <div className="flex items-center gap-2 bg-muted px-4 py-2 comic-border">
                      <Users className="h-4 w-4" />
                      <span className="font-bold">{game.playerCount}</span>
                    </div>
                    
                    <Button variant="poker" size="sm" className="gap-2">
                      <Play className="h-4 w-4" />
                      JOIN
                    </Button>
                  </div>
                </div>
                
                {/* Player chips summary */}
                {game.players && game.players.length > 0 && (
                  <div className="mt-4 pt-4 border-t-2 border-foreground">
                    <div className="flex flex-wrap gap-2">
                      {game.players.map((player) => (
                        <div
                          key={player.id}
                          className={`text-xs px-3 py-1 border-2 border-foreground ${
                            player.folded ? "bg-muted text-muted-foreground" : "bg-white"
                          }`}
                        >
                          <span className="font-bold">{player.name}</span>
                          <span className="ml-2 text-comic-green">${player.stack}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

