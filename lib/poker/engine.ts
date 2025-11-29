/**
 * Poker Game Engine
 * 
 * Core game logic for Texas Hold'em:
 * - State management
 * - Action validation
 * - Betting rounds
 * - Pot calculation
 */

import type { GameState, Player, Card, ActionType, GameStage, PlayerAction } from "@/types";
import { createDeck, shuffleDeck, dealHoleCards, dealCommunityCards } from "./deck";
import { evaluateHand, determineWinners, calculatePotDistribution } from "./evaluator";
import { DEFAULT_SETTINGS, GAME_STAGES, ACTION_TYPES, octasToChips, APT_CONVERSION } from "./constants";
import { generateGameId, hashString } from "@/lib/utils";

/**
 * Create a new game state
 * 
 * NOTE: Players are initialized with stack: 0. 
 * Use updatePlayerStacks() to set real balances from wallets before starting.
 */
export function createGame(
  players: Omit<Player, "cards" | "folded" | "isAllIn" | "isTurn" | "bet" | "isDealer" | "lastAction">[],
  options: {
    smallBlind?: number;
    bigBlind?: number;
    /** Optional: wallet balances in octas to set initial stacks (keyed by player id) */
    walletBalances?: Record<string, number>;
  } = {}
): GameState {
  const smallBlind = options.smallBlind || DEFAULT_SETTINGS.DEFAULT_SMALL_BLIND;
  const bigBlind = options.bigBlind || DEFAULT_SETTINGS.DEFAULT_BIG_BLIND;
  const walletBalances = options.walletBalances || {};
  
  const now = Date.now();
  
  // Initialize players with real balances from wallets (converted to chips)
  // If no wallet balance provided, stack starts at 0 (requires funding before game)
  const fullPlayers: Player[] = players.map((p, index) => {
    const balanceOctas = walletBalances[p.id] || 0;
    const stackChips = octasToChips(balanceOctas);
    
    return {
      ...p,
      stack: stackChips,
      bet: 0,
      cards: [],
      folded: false,
      isAllIn: false,
      isDealer: index === 0,
      isTurn: false,
    };
  });
  
  return {
    gameId: generateGameId(),
    stage: "waiting",
    players: fullPlayers,
    pot: 0,
    communityCards: [],
    currentBet: 0,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    smallBlind,
    bigBlind,
    stateNonce: 0,
    stateHash: "",
    handNumber: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update player stacks with real wallet balances
 * Call this before starting a game to sync stacks with on-chain balances
 * 
 * @param state Current game state
 * @param walletBalances Map of player ID to wallet balance in octas
 * @returns Updated game state with synced stacks
 */
export function updatePlayerStacks(
  state: GameState,
  walletBalances: Record<string, number>
): GameState {
  const updatedPlayers = state.players.map((player) => {
    const balanceOctas = walletBalances[player.id] || 0;
    const stackChips = octasToChips(balanceOctas);
    
    return {
      ...player,
      stack: stackChips,
    };
  });
  
  return {
    ...state,
    players: updatedPlayers,
    updatedAt: Date.now(),
  };
}

/**
 * Check if all players have sufficient balance to play
 * 
 * @param state Game state to check
 * @returns Object with validation result and any underfunded players
 */
export function validatePlayerBalances(state: GameState): {
  valid: boolean;
  underfundedPlayers: { id: string; name: string; stack: number; required: number }[];
  minRequired: number;
} {
  const minRequired = APT_CONVERSION.MIN_BALANCE_CHIPS;
  const underfundedPlayers = state.players
    .filter((p) => p.stack < minRequired)
    .map((p) => ({
      id: p.id,
      name: p.name,
      stack: p.stack,
      required: minRequired,
    }));
  
  return {
    valid: underfundedPlayers.length === 0,
    underfundedPlayers,
    minRequired,
  };
}

/**
 * Start a new hand
 */
export function startHand(state: GameState, seed: string): GameState {
  // Create and shuffle deck
  const deck = createDeck();
  const shuffledDeck = shuffleDeck(deck, seed);
  
  // Get active players
  const activePlayers = state.players.filter((p) => p.stack > 0);
  if (activePlayers.length < DEFAULT_SETTINGS.MIN_PLAYERS) {
    throw new Error("Not enough players with chips to start a hand");
  }
  
  // Deal hole cards
  const { holeCards, remaining } = dealHoleCards(shuffledDeck, state.players.length);
  
  // Update players with cards
  const players: Player[] = state.players.map((p, i) => ({
    ...p,
    cards: holeCards[i] || [],
    bet: 0,
    folded: p.stack === 0, // Auto-fold players with no chips
    isAllIn: false,
    isDealer: i === state.dealerIndex,
    isTurn: false,
    lastAction: undefined,
  }));
  
  // Post blinds
  const sbIndex = getNextActiveIndex(players, state.dealerIndex);
  const bbIndex = getNextActiveIndex(players, sbIndex);
  
  const sbAmount = Math.min(state.smallBlind, players[sbIndex].stack);
  const bbAmount = Math.min(state.bigBlind, players[bbIndex].stack);
  
  players[sbIndex].stack -= sbAmount;
  players[sbIndex].bet = sbAmount;
  if (players[sbIndex].stack === 0) players[sbIndex].isAllIn = true;
  
  players[bbIndex].stack -= bbAmount;
  players[bbIndex].bet = bbAmount;
  if (players[bbIndex].stack === 0) players[bbIndex].isAllIn = true;
  
  // Set first player to act (UTG)
  const utgIndex = getNextActiveIndex(players, bbIndex);
  players[utgIndex].isTurn = true;
  
  const newState: GameState = {
    ...state,
    stage: "preflop",
    players,
    pot: sbAmount + bbAmount,
    communityCards: [],
    currentBet: bbAmount,
    currentPlayerIndex: utgIndex,
    stateNonce: state.stateNonce + 1,
    handNumber: state.handNumber + 1,
    updatedAt: Date.now(),
  };
  
  // Store remaining deck in state hash (for deterministic dealing)
  newState.stateHash = computeStateHash(newState, remaining);
  
  return newState;
}

/**
 * Process a player action
 */
export function processAction(
  state: GameState,
  playerId: string,
  action: ActionType,
  amount: number = 0
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error("Player not found");
  }
  
  if (playerIndex !== state.currentPlayerIndex) {
    throw new Error("Not your turn");
  }
  
  const player = state.players[playerIndex];
  if (player.folded) {
    throw new Error("Player has folded");
  }
  
  // Validate action
  const validActions = getValidActions(state, playerId);
  if (!validActions.includes(action)) {
    throw new Error(`Invalid action: ${action}`);
  }
  
  let newState = { ...state, players: [...state.players] };
  const newPlayer = { ...player };
  newState.players[playerIndex] = newPlayer;
  
  const playerAction: PlayerAction = {
    type: action,
    amount: 0,
    timestamp: Date.now(),
  };
  
  switch (action) {
    case ACTION_TYPES.FOLD:
      newPlayer.folded = true;
      break;
      
    case ACTION_TYPES.CHECK:
      if (state.currentBet > player.bet) {
        throw new Error("Cannot check when there is a bet to call");
      }
      break;
      
    case ACTION_TYPES.CALL:
      const callAmount = Math.min(state.currentBet - player.bet, player.stack);
      newPlayer.stack -= callAmount;
      newPlayer.bet += callAmount;
      newState.pot += callAmount;
      playerAction.amount = callAmount;
      if (newPlayer.stack === 0) newPlayer.isAllIn = true;
      break;
      
    case ACTION_TYPES.BET:
      if (amount < state.bigBlind) {
        throw new Error(`Minimum bet is ${state.bigBlind}`);
      }
      if (amount > player.stack) {
        throw new Error("Not enough chips");
      }
      newPlayer.stack -= amount;
      newPlayer.bet = amount;
      newState.pot += amount;
      newState.currentBet = amount;
      playerAction.amount = amount;
      if (newPlayer.stack === 0) newPlayer.isAllIn = true;
      // Reset acted status for other players
      newState.players = newState.players.map((p, i) => 
        i === playerIndex ? p : { ...p, lastAction: p.folded || p.isAllIn ? p.lastAction : undefined }
      );
      break;
      
    case ACTION_TYPES.RAISE:
      const raiseTotal = state.currentBet + amount;
      const raiseAmount = raiseTotal - player.bet;
      if (amount < state.bigBlind) {
        throw new Error(`Minimum raise is ${state.bigBlind}`);
      }
      if (raiseAmount > player.stack) {
        throw new Error("Not enough chips");
      }
      newPlayer.stack -= raiseAmount;
      newPlayer.bet = raiseTotal;
      newState.pot += raiseAmount;
      newState.currentBet = raiseTotal;
      playerAction.amount = raiseAmount;
      if (newPlayer.stack === 0) newPlayer.isAllIn = true;
      // Reset acted status for other players
      newState.players = newState.players.map((p, i) => 
        i === playerIndex ? p : { ...p, lastAction: p.folded || p.isAllIn ? p.lastAction : undefined }
      );
      break;
      
    case ACTION_TYPES.ALL_IN:
      const allInAmount = player.stack;
      newPlayer.bet += allInAmount;
      newPlayer.stack = 0;
      newPlayer.isAllIn = true;
      newState.pot += allInAmount;
      playerAction.amount = allInAmount;
      if (newPlayer.bet > state.currentBet) {
        newState.currentBet = newPlayer.bet;
        // Reset acted status for other players
        newState.players = newState.players.map((p, i) => 
          i === playerIndex ? p : { ...p, lastAction: p.folded || p.isAllIn ? p.lastAction : undefined }
        );
      }
      break;
  }
  
  newPlayer.lastAction = playerAction;
  newPlayer.isTurn = false;
  
  // Advance game
  newState = advanceGame(newState);
  newState.stateNonce++;
  newState.updatedAt = Date.now();
  newState.stateHash = computeStateHash(newState);
  
  return newState;
}

/**
 * Get valid actions for a player
 */
export function getValidActions(state: GameState, playerId: string): ActionType[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.folded || player.isAllIn) {
    return [];
  }
  
  const actions: ActionType[] = [ACTION_TYPES.FOLD];
  
  if (state.currentBet === player.bet) {
    // No bet to call
    actions.push(ACTION_TYPES.CHECK);
    if (player.stack > 0) {
      actions.push(ACTION_TYPES.BET);
    }
  } else {
    // There's a bet to call
    if (player.stack > state.currentBet - player.bet) {
      actions.push(ACTION_TYPES.CALL);
      actions.push(ACTION_TYPES.RAISE);
    }
  }
  
  if (player.stack > 0) {
    actions.push(ACTION_TYPES.ALL_IN);
  }
  
  return actions;
}

/**
 * Advance the game to the next player or stage
 */
function advanceGame(state: GameState): GameState {
  let newState = { ...state };
  
  // Check for winner by fold
  const activePlayers = newState.players.filter((p) => !p.folded);
  if (activePlayers.length === 1) {
    return endHand(newState, [activePlayers[0].id]);
  }
  
  // Find next player to act
  const nextIndex = findNextPlayerToAct(newState);
  
  if (nextIndex === -1) {
    // Round complete, advance stage
    newState = advanceStage(newState);
  } else {
    // Set next player's turn
    newState.players = newState.players.map((p, i) => ({
      ...p,
      isTurn: i === nextIndex,
    }));
    newState.currentPlayerIndex = nextIndex;
  }
  
  return newState;
}

/**
 * Find the next player who needs to act
 */
function findNextPlayerToAct(state: GameState): number {
  const startIndex = (state.currentPlayerIndex + 1) % state.players.length;
  
  for (let i = 0; i < state.players.length; i++) {
    const index = (startIndex + i) % state.players.length;
    const player = state.players[index];
    
    // Skip folded and all-in players
    if (player.folded || player.isAllIn) continue;
    
    // Check if player needs to act
    // Player needs to act if:
    // 1. They haven't acted this round (no lastAction)
    // 2. OR there was a raise after their last action
    if (!player.lastAction || player.bet < state.currentBet) {
      return index;
    }
  }
  
  return -1; // No one needs to act
}

/**
 * Advance to the next betting stage
 */
function advanceStage(state: GameState): GameState {
  const newState = { ...state };
  
  // Reset bets for new round
  newState.players = newState.players.map((p) => ({
    ...p,
    bet: 0,
    lastAction: undefined,
  }));
  newState.currentBet = 0;
  
  // Check if we should skip to showdown (all but one all-in)
  const canAct = newState.players.filter((p) => !p.folded && !p.isAllIn);
  if (canAct.length <= 1) {
    // Run out remaining community cards and go to showdown
    return runOutBoard(newState);
  }
  
  switch (state.stage) {
    case "preflop":
      newState.stage = "flop";
      newState.communityCards = dealCommunityCardsForStage(newState, "flop");
      break;
    case "flop":
      newState.stage = "turn";
      newState.communityCards = [
        ...newState.communityCards,
        ...dealCommunityCardsForStage(newState, "turn"),
      ];
      break;
    case "turn":
      newState.stage = "river";
      newState.communityCards = [
        ...newState.communityCards,
        ...dealCommunityCardsForStage(newState, "river"),
      ];
      break;
    case "river":
      return goToShowdown(newState);
  }
  
  // Set first player to act (first active after dealer)
  const firstToAct = getNextActiveIndex(newState.players, state.dealerIndex);
  newState.players = newState.players.map((p, i) => ({
    ...p,
    isTurn: i === firstToAct,
  }));
  newState.currentPlayerIndex = firstToAct;
  
  return newState;
}

/**
 * Deal community cards for a stage
 */
function dealCommunityCardsForStage(state: GameState, stage: "flop" | "turn" | "river"): Card[] {
  // In a real implementation, we'd use the remaining deck from state
  // For now, generate deterministically from state hash
  const seed = `${state.stateHash}_${stage}_${state.handNumber}`;
  const deck = shuffleDeck(createDeck(), seed);
  
  // Remove hole cards from consideration
  const usedCards = new Set(
    state.players.flatMap((p) => p.cards.map((c) => `${c.rank}${c.suit}`))
  );
  const availableDeck = deck.filter((c) => !usedCards.has(`${c.rank}${c.suit}`));
  
  // Skip already dealt community cards
  const skipCount = state.communityCards.length;
  const burnAndDealStart = skipCount + 1; // +1 for burn card
  
  if (stage === "flop") {
    return availableDeck.slice(burnAndDealStart, burnAndDealStart + 3);
  }
  return availableDeck.slice(burnAndDealStart, burnAndDealStart + 1);
}

/**
 * Run out the remaining board when everyone is all-in
 */
function runOutBoard(state: GameState): GameState {
  let newState = { ...state };
  
  while (newState.communityCards.length < 5) {
    const stage = newState.communityCards.length === 0 ? "flop" :
                  newState.communityCards.length === 3 ? "turn" : "river";
    newState.communityCards = [
      ...newState.communityCards,
      ...dealCommunityCardsForStage(newState, stage),
    ];
  }
  
  return goToShowdown(newState);
}

/**
 * Go to showdown and determine winner
 */
function goToShowdown(state: GameState): GameState {
  const newState = { ...state, stage: "showdown" as GameStage };
  
  // Evaluate hands for non-folded players
  const contenders = newState.players
    .filter((p) => !p.folded)
    .map((p) => ({
      id: p.id,
      hand: evaluateHand(p.cards, newState.communityCards),
    }));
  
  const winners = determineWinners(contenders);
  const winnerIds = winners.map((w) => w.id);
  
  return endHand(newState, winnerIds);
}

/**
 * End the hand and distribute pot
 */
function endHand(state: GameState, winnerIds: string[]): GameState {
  const distribution = calculatePotDistribution(winnerIds, state.pot);
  
  const newPlayers = state.players.map((p) => {
    const winnings = distribution.find((d) => d.playerId === p.id)?.amount || 0;
    return {
      ...p,
      stack: p.stack + winnings,
      isTurn: false,
    };
  });
  
  return {
    ...state,
    stage: "settled",
    players: newPlayers,
    pot: 0,
  };
}

/**
 * Get the next active player index (not folded, has chips)
 */
function getNextActiveIndex(players: Player[], fromIndex: number): number {
  for (let i = 1; i <= players.length; i++) {
    const index = (fromIndex + i) % players.length;
    if (!players[index].folded && players[index].stack > 0) {
      return index;
    }
  }
  return (fromIndex + 1) % players.length;
}

/**
 * Compute a hash of the game state for verification
 */
function computeStateHash(state: GameState, extraData?: Card[]): string {
  const stateString = JSON.stringify({
    gameId: state.gameId,
    stage: state.stage,
    pot: state.pot,
    currentBet: state.currentBet,
    stateNonce: state.stateNonce,
    handNumber: state.handNumber,
    players: state.players.map((p) => ({
      id: p.id,
      stack: p.stack,
      bet: p.bet,
      folded: p.folded,
    })),
    extraData: extraData?.map((c) => `${c.rank}${c.suit}`),
  });
  
  return hashString(stateString);
}

/**
 * Prepare the next hand (rotate dealer, reset states)
 */
export function prepareNextHand(state: GameState): GameState {
  // Rotate dealer
  const newDealerIndex = getNextActiveIndex(state.players, state.dealerIndex);
  
  // Reset player states
  const newPlayers = state.players.map((p, i) => ({
    ...p,
    cards: [],
    bet: 0,
    folded: false,
    isAllIn: false,
    isDealer: i === newDealerIndex,
    isTurn: false,
    lastAction: undefined,
  }));
  
  return {
    ...state,
    stage: "waiting",
    players: newPlayers,
    communityCards: [],
    pot: 0,
    currentBet: 0,
    dealerIndex: newDealerIndex,
    stateNonce: state.stateNonce + 1,
    updatedAt: Date.now(),
  };
}

