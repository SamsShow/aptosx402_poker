/**
 * Game Hooks
 * 
 * React hooks for game state management
 */

import { useEffect, useCallback, useRef } from "react";
import { useGameStore } from "@/lib/store/game-store";
import type { GameState, ThoughtRecord, TransactionRecord } from "@/types";

interface UseGameOptions {
  gameId?: string;
  autoConnect?: boolean;
  pollInterval?: number;
}

export function useGame(options: UseGameOptions = {}) {
  const { gameId, autoConnect = true, pollInterval = 10000 } = options; // Increased from 2s to 10s

  const {
    gameState,
    thoughts,
    transactions,
    isConnected,
    isLoading,
    error,
    setGameState,
    addThought,
    addTransaction,
    setConnected,
    setLoading,
    setError,
  } = useGameStore();

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch game state
  const fetchGame = useCallback(async () => {
    if (!gameId) return;

    try {
      const res = await fetch(`/api/game/${gameId}`);
      const data = await res.json();

      if (data.success) {
        setGameState(data.gameState);
        // Update thoughts and transactions if provided
        if (data.thoughts) {
          data.thoughts.forEach((t: ThoughtRecord) => addThought(t));
        }
        if (data.transactions) {
          data.transactions.forEach((tx: TransactionRecord) => addTransaction(tx));
        }
        setConnected(true);
        setError(null);
      } else {
        setError(data.error || "Failed to fetch game");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setConnected(false);
    }
  }, [gameId, setGameState, addThought, addTransaction, setConnected, setError]);

  // Create a new game
  const createGame = useCallback(async (
    agentIds?: string[],
    buyIn = 1000,
    smallBlind = 5,
    bigBlind = 10
  ): Promise<string | null> => {
    setLoading(true);
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentIds, buyIn, smallBlind, bigBlind }),
      });
      const data = await res.json();

      if (data.success) {
        setGameState(data.gameState);
        return data.gameId;
      } else {
        setError(data.error);
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
      return null;
    } finally {
      setLoading(false);
    }
  }, [setGameState, setLoading, setError]);

  // Start the game loop
  const startGame = useCallback(async (
    id?: string,
    turnDelay = 2000,
    handDelay = 5000,
    maxHands = 100
  ): Promise<boolean> => {
    const targetId = id || gameId;
    if (!targetId) return false;

    try {
      const res = await fetch(`/api/game/${targetId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnDelay, handDelay, maxHands }),
      });
      const data = await res.json();
      return data.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
      return false;
    }
  }, [gameId, setError]);

  // Stop the game loop
  const stopGame = useCallback(async (id?: string): Promise<boolean> => {
    const targetId = id || gameId;
    if (!targetId) return false;

    try {
      const res = await fetch(`/api/game/${targetId}/run`, {
        method: "DELETE",
      });
      const data = await res.json();
      return data.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop game");
      return false;
    }
  }, [gameId, setError]);

  // Set up polling
  useEffect(() => {
    if (!autoConnect || !gameId) return;

    // Initial fetch
    fetchGame();

    // Set up polling
    pollRef.current = setInterval(fetchGame, pollInterval);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [autoConnect, gameId, pollInterval, fetchGame]);

  return {
    gameState,
    thoughts,
    transactions,
    isConnected,
    isLoading,
    error,
    createGame,
    startGame,
    stopGame,
    refresh: fetchGame,
  };
}

/**
 * Hook for creating and managing a new game
 */
export function useNewGame() {
  const { createGame, startGame, stopGame, ...rest } = useGame({ autoConnect: false });

  const createAndStart = useCallback(async (
    agentIds?: string[],
    options?: {
      buyIn?: number;
      smallBlind?: number;
      bigBlind?: number;
      turnDelay?: number;
      handDelay?: number;
      maxHands?: number;
    }
  ): Promise<string | null> => {
    const gameId = await createGame(
      agentIds,
      options?.buyIn,
      options?.smallBlind,
      options?.bigBlind
    );

    if (gameId) {
      await startGame(gameId, options?.turnDelay, options?.handDelay, options?.maxHands);
    }

    return gameId;
  }, [createGame, startGame]);

  return {
    ...rest,
    createGame,
    startGame,
    stopGame,
    createAndStart,
  };
}

