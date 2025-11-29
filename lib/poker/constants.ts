/**
 * Poker Game Constants
 */

// Suits
export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
export type Suit = typeof SUITS[number];

// Ranks (2-14, where 14 = Ace)
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
export type Rank = typeof RANKS[number];

// Rank values for comparison
export const RANK_VALUES: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  "J": 11,
  "Q": 12,
  "K": 13,
  "A": 14,
};

// Hand rankings (higher = better)
export const HAND_RANKS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
} as const;

export type HandRankName = keyof typeof HAND_RANKS;

// Hand rank descriptions
export const HAND_DESCRIPTIONS: Record<HandRankName, string> = {
  HIGH_CARD: "High Card",
  PAIR: "Pair",
  TWO_PAIR: "Two Pair",
  THREE_OF_A_KIND: "Three of a Kind",
  STRAIGHT: "Straight",
  FLUSH: "Flush",
  FULL_HOUSE: "Full House",
  FOUR_OF_A_KIND: "Four of a Kind",
  STRAIGHT_FLUSH: "Straight Flush",
  ROYAL_FLUSH: "Royal Flush",
};

// Suit symbols for display
export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

// Suit colors
export const SUIT_COLORS: Record<Suit, string> = {
  hearts: "#dc2626",
  diamonds: "#dc2626",
  clubs: "#1f2937",
  spades: "#1f2937",
};

// Game stages
export const GAME_STAGES = {
  WAITING: "waiting",
  PREFLOP: "preflop",
  FLOP: "flop",
  TURN: "turn",
  RIVER: "river",
  SHOWDOWN: "showdown",
  SETTLED: "settled",
} as const;

export type GameStage = typeof GAME_STAGES[keyof typeof GAME_STAGES];

// Action types
export const ACTION_TYPES = {
  FOLD: "fold",
  CHECK: "check",
  CALL: "call",
  BET: "bet",
  RAISE: "raise",
  ALL_IN: "all_in",
} as const;

export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];

// Default game settings
export const DEFAULT_SETTINGS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 5,
  DEFAULT_BUY_IN: 1000,
  DEFAULT_SMALL_BLIND: 5,
  DEFAULT_BIG_BLIND: 10,
  TURN_TIMEOUT_MS: 30000,
  ANIMATION_DELAY_MS: 500,
};

// APT to Chip conversion
// 1 APT = 100,000,000 octas
// 1 chip = 10,000 octas = 0.0001 APT
// This means 1 APT = 10,000 chips
export const APT_CONVERSION = {
  OCTAS_PER_APT: 100_000_000,
  OCTAS_PER_CHIP: 10_000,
  CHIPS_PER_APT: 10_000,
  // Minimum balance required to join a game (0.01 APT = 100 chips)
  MIN_BALANCE_OCTAS: 1_000_000,
  MIN_BALANCE_CHIPS: 100,
} as const;

/**
 * Convert octas to chips
 */
export function octasToChips(octas: number): number {
  return Math.floor(octas / APT_CONVERSION.OCTAS_PER_CHIP);
}

/**
 * Convert chips to octas
 */
export function chipsToOctas(chips: number): number {
  return chips * APT_CONVERSION.OCTAS_PER_CHIP;
}

/**
 * Convert octas to APT (for display)
 */
export function octasToApt(octas: number): number {
  return octas / APT_CONVERSION.OCTAS_PER_APT;
}

/**
 * Convert APT to octas
 */
export function aptToOctas(apt: number): number {
  return Math.floor(apt * APT_CONVERSION.OCTAS_PER_APT);
}

/**
 * Format chips as APT string
 */
export function formatChipsAsApt(chips: number): string {
  const apt = (chips * APT_CONVERSION.OCTAS_PER_CHIP) / APT_CONVERSION.OCTAS_PER_APT;
  return `${apt.toFixed(4)} APT`;
}

