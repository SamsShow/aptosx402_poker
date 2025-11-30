// Card and Deck types
export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type CardNotation = string; // e.g., "Ah" for Ace of hearts

// Game state types
export type GameStage = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown" | "settled";

export type ActionType = "fold" | "check" | "call" | "bet" | "raise" | "all_in";

export interface PlayerAction {
  type: ActionType;
  amount: number;
  timestamp: number;
}

export interface Player {
  id: string;
  address: string;
  name: string;
  model: AgentModel;
  stack: number;
  bet: number;
  cards: Card[];
  folded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
  isTurn: boolean;
  lastAction?: PlayerAction;
  avatar?: string;
}

export interface GameState {
  gameId: string;
  stage: GameStage;
  players: Player[];
  pot: number;
  communityCards: Card[];
  currentBet: number;
  dealerIndex: number;
  currentPlayerIndex: number;
  smallBlind: number;
  bigBlind: number;
  stateNonce: number;
  stateHash: string;
  handNumber: number;
  createdAt: number;
  updatedAt: number;
  creatorAddress?: string; // Wallet address of game creator
}

// Agent types
export type AgentModel = "claude" | "gpt4" | "gemini" | "deepseek" | "grok";

export interface AgentConfig {
  id: string;
  name: string;
  model: AgentModel;
  personality: string;
  avatar: string;
  color: string;
}

export interface ThoughtRecord {
  agentId: string;
  gameId: string;
  turn: number;
  stateHash: string;
  thoughts: string;
  action: ActionType;
  amount: number;
  confidence: number;
  timestamp: number;
  signature: string;
}

// Transaction types
export interface TransactionRecord {
  id: string;
  gameId?: string; // Optional for sponsor transactions
  from: string;
  to: string;
  amount: number;
  amountOctas?: number; // Amount in octas (real APT value)
  type: "buy_in" | "bet" | "pot_win" | "refund" | "settlement" | "sponsor";
  txHash?: string; // Optional - not all transactions have a hash
  explorerUrl?: string; // Link to blockchain explorer
  facilitatorReceipt?: string;
  timestamp: number | string; // Can be number or ISO string
  status: "pending" | "confirmed" | "failed";
  error?: string; // Error message if transaction failed
}

// API types
export interface CreateGameRequest {
  buyIn: number;
  smallBlind: number;
  bigBlind: number;
  players: string[]; // agent IDs
}

export interface GameActionRequest {
  thought: ThoughtRecord;
  facilitatorReceipt: string;
  agentPubkey: string;
}

export interface GameActionResponse {
  success: boolean;
  newState: GameState;
  txHash?: string;
  error?: string;
}

// Hand evaluation types
export type HandRank =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_of_a_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_of_a_kind"
  | "straight_flush"
  | "royal_flush";

export interface HandEvaluation {
  rank: HandRank;
  rankValue: number;
  highCards: number[];
  description: string;
}

// Websocket event types
export type WSEventType =
  | "game_created"
  | "player_joined"
  | "game_started"
  | "stage_changed"
  | "action_taken"
  | "thought_broadcast"
  | "pot_updated"
  | "winner_declared"
  | "game_ended"
  | "transaction_confirmed"
  | "transaction_recorded"
  | "x402_transfer_complete";

export interface WSEvent<T = unknown> {
  type: WSEventType;
  gameId: string;
  payload: T;
  timestamp: number;
}

// Commit-reveal RNG types
export interface SeedCommitment {
  playerId: string;
  commitment: string; // hash of seed
  revealed: boolean;
  seed?: string;
}

export interface RNGState {
  commitments: SeedCommitment[];
  combinedSeed?: string;
  deckPermutation?: number[];
}

