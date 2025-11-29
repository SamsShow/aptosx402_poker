"use client";

import { useState, useEffect, useCallback } from "react";
import { PokerTable } from "./poker/poker-table";
import { ThoughtFeed } from "./poker/thought-feed";
import { TransactionFeed } from "./poker/transaction-feed";
import { GameInfo } from "./poker/game-info";
import { GameSelection } from "./game-selection";
import { ConnectWalletButton } from "./connect-wallet-button";
import { useGameStore } from "@/lib/store/game-store";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PokerLobbyProps {
  initialGameId?: string;
}

export function PokerLobby({ initialGameId }: PokerLobbyProps) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(initialGameId || null);
  const { 
    gameState, 
    thoughts, 
    transactions,
    isLoading,
    error,
    setGameState, 
    setThoughts,
    setTransactions,
    setConnected,
    setLoading,
    setError,
    reset 
  } = useGameStore();

  // Fetch game data
  const fetchGame = useCallback(async () => {
    if (!selectedGameId) return;
    
    try {
      const res = await fetch(`/api/game/${selectedGameId}`);
      const data = await res.json();
      
      if (data.success) {
        setGameState(data.gameState);
        if (data.thoughts) {
          setThoughts(data.thoughts);
        }
        if (data.transactions) {
          setTransactions(data.transactions);
        }
        setConnected(true);
        setError(null);
      } else {
        setError(data.error || "Failed to fetch game");
        setConnected(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setConnected(false);
    }
  }, [selectedGameId, setGameState, setThoughts, setTransactions, setConnected, setError]);

  // Poll for game updates when a game is selected
  useEffect(() => {
    if (!selectedGameId) return;
    
    // Initial fetch
    fetchGame();
    
    // Set up polling every 2 seconds
    const interval = setInterval(fetchGame, 2000);
    
    return () => clearInterval(interval);
  }, [selectedGameId, fetchGame]);

  // Create a new game
  const createGame = async (creatorAddress?: string): Promise<string | null> => {
    setLoading(true);
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyIn: 1000,
          smallBlind: 5,
          bigBlind: 10,
          creatorAddress,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        return data.gameId;
      } else {
        setError(data.error || "Failed to create game");
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Handle game selection
  const handleSelectGame = (gameId: string) => {
    reset(); // Clear previous game state
    setSelectedGameId(gameId);
  };

  // Handle back to lobby
  const handleBackToLobby = () => {
    reset();
    setSelectedGameId(null);
  };

  // Show game selection if no game is selected
  if (!selectedGameId) {
    return (
      <GameSelection 
        onSelectGame={handleSelectGame}
        onCreateGame={createGame}
      />
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col halftone overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white comic-border border-t-0 border-x-0 px-6 py-4 flex items-center justify-between relative">
        {/* Decorative zigzag bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-comic-yellow" />
        
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBackToLobby}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Lobby
          </Button>
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
            Aptos Testnet
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 border-2 border-foreground ${
              gameState ? "bg-comic-green animate-pulse" : "bg-comic-red"
            }`} />
            <span className="font-bold text-sm">
              {gameState ? "LIVE" : "CONNECTING..."}
            </span>
          </div>
          <ConnectWalletButton />
        </div>
      </header>

      {/* Loading/Error states */}
      {isLoading && !gameState && (
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-comic-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-bold text-muted-foreground">Loading game...</p>
          </div>
        </div>
      )}

      {error && !gameState && (
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <div className="comic-card p-8 text-center max-w-md">
            <div className="w-16 h-16 bg-comic-red comic-border mx-auto mb-4 flex items-center justify-center">
              <span className="font-comic text-white text-2xl">!</span>
            </div>
            <h3 className="font-comic text-xl mb-2">CONNECTION ERROR</h3>
            <p className="text-muted-foreground font-bold mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleBackToLobby}>
                Back to Lobby
              </Button>
              <Button variant="poker" onClick={fetchGame}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {gameState && (
        <main className="flex-1 flex overflow-hidden min-h-0" style={{ height: 0 }}>
          {/* Left panel - Game Info */}
          <aside className="w-80 bg-white comic-border border-t-0 border-l-0 p-6 overflow-y-auto flex-shrink-0 h-full">
            <GameInfo gameId={selectedGameId} />
            <div className="mt-8">
              <TransactionFeed transactions={transactions} />
            </div>
          </aside>

          {/* Center - Poker Table */}
          <section className="flex-1 relative overflow-hidden min-h-0 h-full">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-30 pointer-events-none">
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 25px 25px, hsl(var(--comic-yellow) / 0.3) 2px, transparent 0)`,
                backgroundSize: '50px 50px'
              }} />
            </div>
            
            {/* Poker table container - fixed at top */}
            <div className="absolute inset-0 flex items-start justify-center pt-12 px-12 pb-12">
              <PokerTable gameState={gameState} />
            </div>
          </section>

          {/* Right panel - Thoughts */}
          <aside className="w-96 bg-white comic-border border-t-0 border-r-0 p-6 flex flex-col flex-shrink-0 min-h-0 h-full">
            <ThoughtFeed thoughts={thoughts} />
          </aside>
        </main>
      )}
    </div>
  );
}
