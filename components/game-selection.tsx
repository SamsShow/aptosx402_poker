"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  User,
  Bot,
  Wallet,
  HelpCircle
} from "lucide-react";
import { useRouter } from "next/navigation";

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
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMounted = useRef(true);
  const router = useRouter();

  // Wallet connection
  const { connected, account } = useWallet();

  // Default game settings
  const DEFAULT_BUY_IN = 1000;

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

    // Removed auto-refresh - use manual refresh button to update
    // This prevents excessive API calls and rate limiting

    return () => {
      isMounted.current = false;
    };
  }, [fetchGames]);

  const handleCreateGame = async () => {
    setCreating(true);
    setLoadingStep(0);

    const loadingSteps = [
      "Shuffling deck...",
      "Waking up agents...",
      "Generating wallets...",
      "Setting up table...",
      "Ready to play!"
    ];

    // Animate through loading steps more slowly
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev < loadingSteps.length - 1) return prev + 1;
        return prev;
      });
    }, 1200); // Slower: 1.2 seconds per step

    try {
      // Pass connected wallet address as creator
      const creatorAddress = connected ? account?.address?.toString() : undefined;
      const gameId = await onCreateGame(creatorAddress);
      if (gameId) {
        // Complete the animation smoothly
        setLoadingStep(loadingSteps.length - 1);
        await new Promise(resolve => setTimeout(resolve, 800));
        // Go directly to the game
        onSelectGame(gameId);
      }
    } catch (err) {
      console.error("Failed to create game:", err);
      clearInterval(stepInterval);
      setCreating(false);
      setLoadingStep(0);
    } finally {
      clearInterval(stepInterval);
      // Don't reset creating/loadingStep here - let navigation handle it
    }
  };

  // Handle joining a game - go directly to it
  const handleJoinGame = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onSelectGame(gameId);
  };

  // Manual refresh with indicator
  const loadingMessages = [
    "Shuffling deck...",
    "Waking up agents...",
    "Generating wallets...",
    "Setting up table...",
    "Ready to play!"
  ];

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

  // Full-screen loading view with ONE continuous animation
  const LoadingView = () => {
    const progress = ((loadingStep + 1) / loadingMessages.length) * 100;

    return (
      <div className="min-h-screen bg-background halftone">
        <div className="max-w-4xl mx-auto p-8">
          {/* Keep the header */}
          <motion.div
            className="mb-12"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 comic-border flex items-center justify-center comic-shadow overflow-hidden">
                  <Image
                    src="/x402-logo.png"
                    alt="x402 Poker Logo"
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                </div>
              </div>
              <ConnectWalletButton />
            </div>
            <div className="text-center">
              <h1 className="font-comic text-5xl mb-2">GAME LOBBY</h1>
              <p className="text-muted-foreground font-bold">
                Creating your game...
              </p>
            </div>
          </motion.div>

          {/* Loading content - centered */}
          <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
            <motion.div
              className="text-center max-w-lg w-full"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Animated poker chips - continuous smooth rotation */}
              <div className="relative h-40 mb-12">
                <motion.div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-20 bg-comic-red comic-border rounded-full flex items-center justify-center font-comic text-white text-3xl shadow-lg"
                  animate={{
                    y: [0, -20, 0],
                    rotate: 360,
                  }}
                  transition={{
                    y: {
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    },
                    rotate: {
                      duration: 4,
                      repeat: Infinity,
                      ease: "linear"
                    }
                  }}
                >
                  ♠
                </motion.div>
                <motion.div
                  className="absolute top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-comic-blue comic-border rounded-full flex items-center justify-center font-comic text-white text-3xl shadow-lg"
                  animate={{
                    y: [0, -20, 0],
                    rotate: -360,
                  }}
                  transition={{
                    y: {
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.4
                    },
                    rotate: {
                      duration: 4,
                      repeat: Infinity,
                      ease: "linear",
                      delay: 0.4
                    }
                  }}
                >
                  ♥
                </motion.div>
              </div>

              {/* Continuous sliding text - ONE animation, not multiple restarts */}
              <div className="relative h-20 mb-8 overflow-hidden">
                <motion.div
                  className="font-comic text-4xl whitespace-nowrap"
                  animate={{
                    y: -loadingStep * 80, // Slide up continuously
                  }}
                  transition={{
                    duration: 0.8,
                    ease: [0.25, 0.1, 0.25, 1] // Smooth easing
                  }}
                >
                  {loadingMessages.map((message, index) => (
                    <div
                      key={index}
                      className="h-20 flex items-center justify-center"
                      style={{
                        opacity: index === loadingStep ? 1 : 0.3,
                        transform: index === loadingStep ? 'scale(1)' : 'scale(0.9)',
                        transition: 'opacity 0.8s ease, transform 0.8s ease'
                      }}
                    >
                      {message}
                    </div>
                  ))}
                </motion.div>
              </div>

              {/* Continuous smooth progress bar */}
              <div className="mb-6">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-comic-blue via-comic-purple to-comic-green rounded-full"
                    animate={{
                      width: `${progress}%`
                    }}
                    transition={{
                      duration: 1.0,
                      ease: [0.25, 0.1, 0.25, 1]
                    }}
                  />
                </div>
              </div>

              {/* Smooth percentage counter */}
              <motion.p
                className="text-muted-foreground font-bold text-lg"
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {Math.round(progress)}% Complete
              </motion.p>
            </motion.div>
          </div>
        </div>
      </div>
    );
  };

  // Show loading view instead of normal content when creating
  if (creating) {
    return <LoadingView />;
  }

  return (
    <div className="min-h-screen bg-background halftone p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          className="mb-12"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 comic-border flex items-center justify-center comic-shadow overflow-hidden">
                <Image
                  src="/x402-logo.png"
                  alt="x402 Poker Logo"
                  width={64}
                  height={64}
                  className="object-contain"
                />
              </div>
            </div>
            <ConnectWalletButton />
          </div>
          <div className="text-center">
            <h1 className="font-comic text-5xl mb-2">GAME LOBBY</h1>
            <p className="text-muted-foreground font-bold">
              Select an active game or create a new one
            </p>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3">
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
              variant="outline"
              onClick={() => router.push("/agents")}
              className="gap-2"
            >
              <Bot className="h-4 w-4" />
              Agents
            </Button>
          </div>

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
                className="comic-card p-6 hover:translate-x-1 hover:-translate-y-1 transition-transform"
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
                    {/* Stage badge with tooltip */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`comic-badge ${getStageColor(game.stage)} text-white px-3 py-1 cursor-help`}>
                            {formatStage(game.stage)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[200px]">
                          <p className="font-bold">Betting Round</p>
                          <p className="text-xs text-muted-foreground">
                            {game.stage === "waiting" && "Game hasn't started yet"}
                            {game.stage === "preflop" && "First betting round before community cards"}
                            {game.stage === "flop" && "Second round after 3 community cards"}
                            {game.stage === "turn" && "Third round after 4th community card"}
                            {game.stage === "river" && "Final round after 5th community card"}
                            {game.stage === "showdown" && "Cards revealed, determining winner"}
                            {game.stage === "settled" && "Hand complete, pot distributed"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Pot with tooltip */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 bg-comic-yellow px-4 py-2 comic-border cursor-help">
                            <Coins className="h-4 w-4" />
                            <span className="font-comic">${game.pot}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="font-bold">Current Pot</p>
                          <p className="text-xs text-muted-foreground">
                            Total chips bet by all players in this hand
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Players count with tooltip */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 bg-muted px-4 py-2 comic-border cursor-help">
                            <Users className="h-4 w-4" />
                            <span className="font-bold">{game.playerCount}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="font-bold">Players</p>
                          <p className="text-xs text-muted-foreground">
                            Number of AI agents in this game
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button
                      variant="poker"
                      size="sm"
                      className="gap-2"
                      onClick={(e) => handleJoinGame(game.gameId, e)}
                    >
                      <Play className="h-4 w-4" />
                      {game.stage === "waiting" ? "JOIN" : "WATCH"}
                    </Button>
                  </div>
                </div>

                {/* Player chips summary */}
                {game.players && game.players.length > 0 && (
                  <div className="mt-4 pt-4 border-t-2 border-foreground">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-muted-foreground">PLAYER STACKS (REAL APT)</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px]">
                            <p className="font-bold">Real APT Balances</p>
                            <p className="text-xs text-muted-foreground">
                              Each player&apos;s chip stack backed by real APT. 1 chip = 0.0001 APT.
                              {game.stage === "waiting" && " Agents need funding before game starts."}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {game.players.map((player) => {
                        const aptValue = (player.stack * 10000) / 100_000_000; // chips to APT
                        const needsFunding = player.stack < 100; // MIN_BALANCE_CHIPS

                        return (
                          <TooltipProvider key={player.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`text-xs px-3 py-1 border-2 border-foreground cursor-help ${player.folded ? "bg-muted text-muted-foreground line-through" :
                                    needsFunding && game.stage === "waiting" ? "bg-comic-orange/20 border-comic-orange" :
                                      "bg-white"
                                    }`}
                                >
                                  <span className="font-bold">{player.name}</span>
                                  <span className={`ml-2 ${player.folded ? "text-muted-foreground" :
                                    needsFunding ? "text-comic-orange" : "text-comic-green"
                                    }`}>
                                    {player.stack > 0 ? `${aptValue.toFixed(4)} APT` : "Not funded"}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="font-bold">{player.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {player.folded
                                    ? "Folded this hand"
                                    : needsFunding && game.stage === "waiting"
                                      ? "Needs funding to play"
                                      : `${player.stack} chips (${aptValue.toFixed(4)} APT)`
                                  }
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Info banner about funding */}
        <div className="mt-8 p-4 comic-card bg-comic-yellow/10 border-comic-yellow">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-comic-yellow comic-border flex items-center justify-center flex-shrink-0">
              <Wallet className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-bold mb-1">Real APT Gameplay</h3>
              <p className="text-sm text-muted-foreground">
                Agents play with <strong>real APT tokens</strong> using the x402 protocol.
                Before starting, fund agents via faucet or wallet transfer.
                Winnings are distributed automatically at the end of each hand.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                1 chip = 0.0001 APT • Minimum: 0.01 APT (100 chips) per agent
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

