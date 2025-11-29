/**
 * Game State Store
 * 
 * Zustand store for managing game state on the client
 */

import { create } from "zustand";
import type { GameState, ThoughtRecord, TransactionRecord, Player } from "@/types";
import { AGENT_CONFIGS } from "@/types/agents";

interface GameStore {
  // Game state
  gameState: GameState | null;
  thoughts: ThoughtRecord[];
  transactions: TransactionRecord[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setGameState: (state: GameState) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  addThought: (thought: ThoughtRecord) => void;
  addTransaction: (tx: TransactionRecord) => void;
  updateTransaction: (txId: string, updates: Partial<TransactionRecord>) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// Create mock initial state for development
const createMockGameState = (): GameState => {
  const agents = Object.values(AGENT_CONFIGS).slice(0, 5);
  
  return {
    gameId: "game_demo_001",
    stage: "flop",
    players: agents.map((agent, index) => ({
      id: agent.id,
      address: `0x${index.toString().repeat(40)}`,
      name: agent.name,
      model: agent.model,
      stack: 950 + Math.floor(Math.random() * 100),
      bet: index === 2 ? 50 : index === 3 ? 50 : 0,
      cards: [
        { rank: "A", suit: "hearts" },
        { rank: "K", suit: "clubs" },
      ],
      folded: index === 4,
      isAllIn: false,
      isDealer: index === 0,
      isTurn: index === 1,
      avatar: agent.avatar,
    })),
    pot: 150,
    communityCards: [
      { rank: "7", suit: "hearts" },
      { rank: "6", suit: "clubs" },
      { rank: "8", suit: "clubs" },
    ],
    currentBet: 50,
    dealerIndex: 0,
    currentPlayerIndex: 1,
    smallBlind: 5,
    bigBlind: 10,
    stateNonce: 42,
    stateHash: "0xdeadbeef",
    handNumber: 7,
    createdAt: Date.now() - 300000,
    updatedAt: Date.now(),
  };
};

const createMockThoughts = (): ThoughtRecord[] => [
  {
    agentId: "agent_claude",
    gameId: "game_demo_001",
    turn: 42,
    stateHash: "0xdeadbeef",
    thoughts: "The flop gives me an open-ended straight draw. With two overcards, I have decent equity. I'll call the bet to see the turn.",
    action: "call",
    amount: 50,
    confidence: 0.72,
    timestamp: Date.now() - 60000,
    signature: "0xsig1...",
  },
  {
    agentId: "agent_gpt4",
    gameId: "game_demo_001",
    turn: 41,
    stateHash: "0xabcd1234",
    thoughts: "Position is key here. I'm in the cutoff with a strong hand. A standard 3x raise should build the pot while maintaining fold equity.",
    action: "raise",
    amount: 50,
    confidence: 0.85,
    timestamp: Date.now() - 120000,
    signature: "0xsig2...",
  },
  {
    agentId: "agent_gemini",
    gameId: "game_demo_001",
    turn: 40,
    stateHash: "0x5678efgh",
    thoughts: "Aggressive play has been profitable. With the button, I'm raising to apply pressure and potentially steal the blinds.",
    action: "bet",
    amount: 30,
    confidence: 0.68,
    timestamp: Date.now() - 180000,
    signature: "0xsig3...",
  },
];

const createMockTransactions = (): TransactionRecord[] => [
  {
    id: "tx_001",
    gameId: "game_demo_001",
    from: "agent_claude",
    to: "pot",
    amount: 50,
    type: "bet",
    txHash: "0x1234...5678",
    timestamp: Date.now() - 60000,
    status: "confirmed",
  },
  {
    id: "tx_002",
    gameId: "game_demo_001",
    from: "agent_gpt4",
    to: "pot",
    amount: 50,
    type: "bet",
    txHash: "0xabcd...efgh",
    timestamp: Date.now() - 120000,
    status: "confirmed",
  },
];

const initialState = {
  gameState: createMockGameState(),
  thoughts: createMockThoughts(),
  transactions: createMockTransactions(),
  isConnected: true,
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
  
  addThought: (thought) => set((store) => ({
    thoughts: [thought, ...store.thoughts].slice(0, 50), // Keep last 50
  })),
  
  addTransaction: (tx) => set((store) => ({
    transactions: [tx, ...store.transactions].slice(0, 100), // Keep last 100
  })),
  
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

