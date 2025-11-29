/**
 * Deck Management
 * 
 * Handles card deck creation, shuffling, and dealing
 * Uses deterministic shuffling based on combined seed for fairness
 */

import { SUITS, RANKS, type Suit, type Rank } from "./constants";
import type { Card } from "@/types";

/**
 * Create a standard 52-card deck
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  
  return deck;
}

/**
 * Fisher-Yates shuffle with deterministic seed
 */
export function shuffleDeck(deck: Card[], seed: string): Card[] {
  const shuffled = [...deck];
  const rng = createSeededRNG(seed);
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * Create a seeded random number generator
 * Uses a simple but effective hash-based approach
 */
function createSeededRNG(seed: string): () => number {
  let state = hashString(seed);
  
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Hash a string to a number for seeding
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash >>> 0; // Convert to unsigned 32-bit
  }
  return hash || 1; // Ensure non-zero
}

/**
 * Deal cards from the deck
 */
export function dealCards(deck: Card[], count: number): { dealt: Card[]; remaining: Card[] } {
  return {
    dealt: deck.slice(0, count),
    remaining: deck.slice(count),
  };
}

/**
 * Deal hole cards to players
 */
export function dealHoleCards(
  deck: Card[],
  playerCount: number
): { holeCards: Card[][]; remaining: Card[] } {
  const holeCards: Card[][] = [];
  let currentDeck = [...deck];
  
  // Deal 2 cards to each player (one at a time, like real dealing)
  for (let round = 0; round < 2; round++) {
    for (let player = 0; player < playerCount; player++) {
      if (round === 0) {
        holeCards[player] = [];
      }
      const { dealt, remaining } = dealCards(currentDeck, 1);
      holeCards[player].push(dealt[0]);
      currentDeck = remaining;
    }
  }
  
  return { holeCards, remaining: currentDeck };
}

/**
 * Deal community cards for a stage
 */
export function dealCommunityCards(
  deck: Card[],
  stage: "flop" | "turn" | "river"
): { cards: Card[]; remaining: Card[] } {
  // Burn one card first
  const afterBurn = deck.slice(1);
  
  const count = stage === "flop" ? 3 : 1;
  const { dealt, remaining } = dealCards(afterBurn, count);
  return { cards: dealt, remaining };
}

/**
 * Convert card to notation string (e.g., "Ah" for Ace of hearts)
 */
export function cardToNotation(card: Card): string {
  const rankStr = card.rank === "10" ? "T" : card.rank;
  const suitStr = card.suit[0]; // First letter: h, d, c, s
  return `${rankStr}${suitStr}`;
}

/**
 * Parse notation string to card
 */
export function notationToCard(notation: string): Card {
  const rankStr = notation.slice(0, -1);
  const suitChar = notation.slice(-1).toLowerCase();
  
  const rank = rankStr === "T" ? "10" : rankStr as Rank;
  
  const suitMap: Record<string, Suit> = {
    h: "hearts",
    d: "diamonds",
    c: "clubs",
    s: "spades",
  };
  
  return { rank, suit: suitMap[suitChar] };
}

/**
 * Get a display string for a card
 */
export function cardToString(card: Card): string {
  const suitSymbols: Record<Suit, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };
  
  return `${card.rank}${suitSymbols[card.suit]}`;
}

/**
 * Generate a random seed for shuffling
 */
export function generateRandomSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Combine multiple seeds into one (for commit-reveal)
 */
export function combineSeeds(seeds: string[]): string {
  const combined = seeds.sort().join("");
  return hashToHex(combined);
}

/**
 * Hash a string to hex
 */
function hashToHex(str: string): string {
  let hash = BigInt(0);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << BigInt(5)) - hash) + BigInt(str.charCodeAt(i));
    hash = hash & BigInt("0xFFFFFFFFFFFFFFFF"); // Keep as 64-bit
  }
  return hash.toString(16).padStart(16, "0");
}

