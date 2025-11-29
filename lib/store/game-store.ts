/**
 * Game State Store
 * 
 * Zustand store for managing game state on the client
 */

import { create } from "zustand";
import type { GameState, ThoughtRecord, TransactionRecord, Player } from "@/types";

interface GameStore {
  // Game state
  gameState: GameState | null;
  thoughts: ThoughtRecord[];
  transactions: TransactionRecord[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setGameState: (state: GameState | null) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  addThought: (thought: ThoughtRecord) => void;
  setThoughts: (thoughts: ThoughtRecord[]) => void;
  addTransaction: (tx: TransactionRecord) => void;
  setTransactions: (transactions: TransactionRecord[]) => void;
  updateTransaction: (txId: string, updates: Partial<TransactionRecord>) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// Initial state - empty, will be populated by API calls
const initialState = {
  gameState: null,
  thoughts: [],
  transactions: [],
  isConnected: false,
  isLoading: false,
  error: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  
  setGameState: (state) => set({ gameState: state }),
  
  updatePlayer: (playerId, updates) => set((store) => {
    if (!store.gameState) return store;
    
    return {
      gameState: {
        ...store.gameState,
        players: store.gameState.players.map((p) =>
          p.id === playerId ? { ...p, ...updates } : p
        ),
      },
    };
  }),
  
  addThought: (thought) => set((store) => {
    // Check if thought already exists (by agentId + turn + action)
    const exists = store.thoughts.some(
      (t) => t.agentId === thought.agentId && t.turn === thought.turn && t.action === thought.action
    );
    if (exists) return store;
    
    return {
      thoughts: [thought, ...store.thoughts].slice(0, 50), // Keep last 50
    };
  }),
  
  setThoughts: (thoughts) => set({ thoughts }),
  
  addTransaction: (tx) => set((store) => {
    // Check if transaction already exists
    const exists = store.transactions.some((t) => t.id === tx.id);
    if (exists) return store;
    
    return {
      transactions: [tx, ...store.transactions].slice(0, 100), // Keep last 100
    };
  }),
  
  setTransactions: (transactions) => set({ transactions }),
  
  updateTransaction: (txId, updates) => set((store) => ({
    transactions: store.transactions.map((tx) =>
      tx.id === txId ? { ...tx, ...updates } : tx
    ),
  })),
  
  setConnected: (isConnected) => set({ isConnected }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
  
  reset: () => set(initialState),
}));

// Selector hooks for common patterns
export const useCurrentPlayer = () => useGameStore((state) => 
  state.gameState?.players.find((p) => p.isTurn)
);

export const useActivePlayers = () => useGameStore((state) =>
  state.gameState?.players.filter((p) => !p.folded) || []
);

export const usePot = () => useGameStore((state) => state.gameState?.pot || 0);

export const useStage = () => useGameStore((state) => state.gameState?.stage || "waiting");
