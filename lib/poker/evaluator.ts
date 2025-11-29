/**
 * Hand Evaluator
 * 
 * Evaluates poker hands and determines winners
 * Implements standard Texas Hold'em hand rankings
 */

import { RANK_VALUES, HAND_RANKS, HAND_DESCRIPTIONS, type HandRankName } from "./constants";
import type { Card, HandEvaluation } from "@/types";

interface CardValue {
  rank: number;
  suit: string;
}

/**
 * Evaluate the best 5-card hand from 7 cards (2 hole + 5 community)
 */
export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandEvaluation {
  const allCards = [...holeCards, ...communityCards];
  
  if (allCards.length < 5) {
    return {
      rank: "high_card",
      rankValue: HAND_RANKS.HIGH_CARD,
      highCards: [],
      description: "Not enough cards",
    };
  }
  
  // Convert to internal format
  const cards: CardValue[] = allCards.map((c) => ({
    rank: RANK_VALUES[c.rank],
    suit: c.suit,
  }));
  
  // Get all 5-card combinations
  const combinations = getCombinations(cards, 5);
  
  // Evaluate each combination and find the best
  let bestHand: HandEvaluation | null = null;
  
  for (const combo of combinations) {
    const evaluation = evaluateFiveCards(combo);
    if (!bestHand || compareHands(evaluation, bestHand) > 0) {
      bestHand = evaluation;
    }
  }
  
  return bestHand!;
}

/**
 * Evaluate exactly 5 cards
 */
function evaluateFiveCards(cards: CardValue[]): HandEvaluation {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  
  const isFlush = checkFlush(sorted);
  const straightHighCard = checkStraight(sorted);
  const isStraight = straightHighCard > 0;
  
  const rankCounts = getRankCounts(sorted);
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  
  // Royal Flush
  if (isFlush && isStraight && straightHighCard === 14) {
    return {
      rank: "royal_flush",
      rankValue: HAND_RANKS.ROYAL_FLUSH,
      highCards: [14, 13, 12, 11, 10],
      description: HAND_DESCRIPTIONS.ROYAL_FLUSH,
    };
  }
  
  // Straight Flush
  if (isFlush && isStraight) {
    return {
      rank: "straight_flush",
      rankValue: HAND_RANKS.STRAIGHT_FLUSH,
      highCards: getStraightHighCards(straightHighCard),
      description: HAND_DESCRIPTIONS.STRAIGHT_FLUSH,
    };
  }
  
  // Four of a Kind
  if (counts[0] === 4) {
    const quadRank = getCountRank(rankCounts, 4);
    const kicker = getCountRank(rankCounts, 1);
    return {
      rank: "four_of_a_kind",
      rankValue: HAND_RANKS.FOUR_OF_A_KIND,
      highCards: [quadRank, kicker],
      description: HAND_DESCRIPTIONS.FOUR_OF_A_KIND,
    };
  }
  
  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    const tripRank = getCountRank(rankCounts, 3);
    const pairRank = getCountRank(rankCounts, 2);
    return {
      rank: "full_house",
      rankValue: HAND_RANKS.FULL_HOUSE,
      highCards: [tripRank, pairRank],
      description: HAND_DESCRIPTIONS.FULL_HOUSE,
    };
  }
  
  // Flush
  if (isFlush) {
    return {
      rank: "flush",
      rankValue: HAND_RANKS.FLUSH,
      highCards: sorted.map((c) => c.rank).slice(0, 5),
      description: HAND_DESCRIPTIONS.FLUSH,
    };
  }
  
  // Straight
  if (isStraight) {
    return {
      rank: "straight",
      rankValue: HAND_RANKS.STRAIGHT,
      highCards: getStraightHighCards(straightHighCard),
      description: HAND_DESCRIPTIONS.STRAIGHT,
    };
  }
  
  // Three of a Kind
  if (counts[0] === 3) {
    const tripRank = getCountRank(rankCounts, 3);
    const kickers = sorted
      .filter((c) => c.rank !== tripRank)
      .map((c) => c.rank)
      .slice(0, 2);
    return {
      rank: "three_of_a_kind",
      rankValue: HAND_RANKS.THREE_OF_A_KIND,
      highCards: [tripRank, ...kickers],
      description: HAND_DESCRIPTIONS.THREE_OF_A_KIND,
    };
  }
  
  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    const pairs = getPairRanks(rankCounts);
    const kicker = sorted.find((c) => !pairs.includes(c.rank))?.rank || 0;
    return {
      rank: "two_pair",
      rankValue: HAND_RANKS.TWO_PAIR,
      highCards: [...pairs, kicker],
      description: HAND_DESCRIPTIONS.TWO_PAIR,
    };
  }
  
  // Pair
  if (counts[0] === 2) {
    const pairRank = getCountRank(rankCounts, 2);
    const kickers = sorted
      .filter((c) => c.rank !== pairRank)
      .map((c) => c.rank)
      .slice(0, 3);
    return {
      rank: "pair",
      rankValue: HAND_RANKS.PAIR,
      highCards: [pairRank, ...kickers],
      description: HAND_DESCRIPTIONS.PAIR,
    };
  }
  
  // High Card
  return {
    rank: "high_card",
    rankValue: HAND_RANKS.HIGH_CARD,
    highCards: sorted.map((c) => c.rank).slice(0, 5),
    description: HAND_DESCRIPTIONS.HIGH_CARD,
  };
}

/**
 * Check if all cards are the same suit
 */
function checkFlush(cards: CardValue[]): boolean {
  return cards.every((c) => c.suit === cards[0].suit);
}

/**
 * Check for a straight, returns high card of straight or 0
 */
function checkStraight(cards: CardValue[]): number {
  const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => b - a);
  
  // Check normal straight
  for (let i = 0; i <= ranks.length - 5; i++) {
    if (ranks[i] - ranks[i + 4] === 4) {
      return ranks[i];
    }
  }
  
  // Check wheel (A-2-3-4-5)
  if (ranks.includes(14) && ranks.includes(5) && ranks.includes(4) && 
      ranks.includes(3) && ranks.includes(2)) {
    return 5; // 5-high straight
  }
  
  return 0;
}

/**
 * Get rank counts (e.g., {14: 2, 10: 2, 7: 1} for two pair)
 */
function getRankCounts(cards: CardValue[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const card of cards) {
    counts[card.rank] = (counts[card.rank] || 0) + 1;
  }
  return counts;
}

/**
 * Get the rank that appears a specific number of times
 */
function getCountRank(counts: Record<number, number>, count: number): number {
  const entry = Object.entries(counts).find(([, c]) => c === count);
  return entry ? parseInt(entry[0]) : 0;
}

/**
 * Get pair ranks sorted by rank value
 */
function getPairRanks(counts: Record<number, number>): number[] {
  return Object.entries(counts)
    .filter(([, c]) => c === 2)
    .map(([r]) => parseInt(r))
    .sort((a, b) => b - a);
}

/**
 * Get high cards for a straight
 */
function getStraightHighCards(highCard: number): number[] {
  if (highCard === 5) {
    // Wheel
    return [5, 4, 3, 2, 14];
  }
  return [highCard, highCard - 1, highCard - 2, highCard - 3, highCard - 4];
}

/**
 * Get all k-combinations of an array
 */
function getCombinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  
  function combine(start: number, combo: T[]) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  
  combine(0, []);
  return result;
}

/**
 * Compare two hands, returns positive if a > b, negative if a < b, 0 if equal
 */
export function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  // Compare rank first
  if (a.rankValue !== b.rankValue) {
    return a.rankValue - b.rankValue;
  }
  
  // Compare high cards
  for (let i = 0; i < Math.max(a.highCards.length, b.highCards.length); i++) {
    const aCard = a.highCards[i] || 0;
    const bCard = b.highCards[i] || 0;
    if (aCard !== bCard) {
      return aCard - bCard;
    }
  }
  
  return 0;
}

/**
 * Determine winners from a list of players with their hands
 */
export function determineWinners(
  players: { id: string; hand: HandEvaluation }[]
): { id: string; hand: HandEvaluation }[] {
  if (players.length === 0) return [];
  if (players.length === 1) return players;
  
  // Sort by hand strength
  const sorted = [...players].sort((a, b) => compareHands(b.hand, a.hand));
  
  // Find all players tied with the best hand
  const winners = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (compareHands(sorted[i].hand, sorted[0].hand) === 0) {
      winners.push(sorted[i]);
    } else {
      break;
    }
  }
  
  return winners;
}

/**
 * Calculate pot distribution for winners (handles split pots)
 */
export function calculatePotDistribution(
  winners: string[],
  pot: number
): { playerId: string; amount: number }[] {
  const share = Math.floor(pot / winners.length);
  const remainder = pot % winners.length;
  
  return winners.map((playerId, index) => ({
    playerId,
    // First player gets the remainder in case of odd division
    amount: share + (index === 0 ? remainder : 0),
  }));
}

/**
 * Get a human-readable description of a hand
 */
export function getHandDescription(hand: HandEvaluation): string {
  const rankNames: Record<number, string> = {
    14: "Ace",
    13: "King",
    12: "Queen",
    11: "Jack",
    10: "Ten",
    9: "Nine",
    8: "Eight",
    7: "Seven",
    6: "Six",
    5: "Five",
    4: "Four",
    3: "Three",
    2: "Two",
  };
  
  switch (hand.rank) {
    case "royal_flush":
      return "Royal Flush";
    case "straight_flush":
      return `Straight Flush, ${rankNames[hand.highCards[0]]} high`;
    case "four_of_a_kind":
      return `Four ${rankNames[hand.highCards[0]]}s`;
    case "full_house":
      return `Full House, ${rankNames[hand.highCards[0]]}s full of ${rankNames[hand.highCards[1]]}s`;
    case "flush":
      return `Flush, ${rankNames[hand.highCards[0]]} high`;
    case "straight":
      return `Straight, ${rankNames[hand.highCards[0]]} high`;
    case "three_of_a_kind":
      return `Three ${rankNames[hand.highCards[0]]}s`;
    case "two_pair":
      return `Two Pair, ${rankNames[hand.highCards[0]]}s and ${rankNames[hand.highCards[1]]}s`;
    case "pair":
      return `Pair of ${rankNames[hand.highCards[0]]}s`;
    case "high_card":
    default:
      return `${rankNames[hand.highCards[0]]} high`;
  }
}

