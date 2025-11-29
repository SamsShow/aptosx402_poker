/**
 * Game Database Operations
 * 
 * Handles persistence of games, hands, actions, thoughts, and transactions
 */

import { db, games, hands, actions, thoughts, transactions } from "./index";
import { eq, desc } from "drizzle-orm";
import type { GameState, ThoughtRecord, TransactionRecord } from "@/types";

/**
 * Save or update a game in the database
 */
export async function saveGame(
  gameState: GameState, 
  buyIn: number, 
  smallBlind: number, 
  bigBlind: number,
  creatorAddress?: string
): Promise<void> {
  await db
    .insert(games)
    .values({
      id: gameState.gameId,
      stage: gameState.stage,
      buyIn,
      smallBlind,
      bigBlind,
      handNumber: gameState.handNumber,
      totalHands: gameState.handNumber,
      updatedAt: new Date(),
      creatorAddress: creatorAddress || gameState.creatorAddress || null,
      gameState: gameState as unknown as Record<string, unknown>, // Store full state
    })
    .onConflictDoUpdate({
      target: games.id,
      set: {
        stage: gameState.stage,
        handNumber: gameState.handNumber,
        totalHands: gameState.handNumber,
        updatedAt: new Date(),
        gameState: gameState as unknown as Record<string, unknown>,
      },
    });
}

/**
 * Save a hand to the database
 */
export async function saveHand(
  gameId: string,
  handNumber: number,
  startState: GameState,
  endState: GameState,
  potSize: number,
  winnerId?: string
): Promise<string> {
  const handId = `hand_${gameId}_${handNumber}`;
  
  await db
    .insert(hands)
    .values({
      id: handId,
      gameId,
      handNumber,
      startState: startState as any,
      endState: endState as any,
      potSize,
      winnerId: winnerId || null,
    })
    .onConflictDoUpdate({
      target: hands.id,
      set: {
        endState: endState as any,
        potSize,
        winnerId: winnerId || null,
      },
    });
  
  return handId;
}

/**
 * Save an action to the database
 */
export async function saveAction(
  handId: string,
  playerId: string,
  actionType: string,
  amount: number,
  stateHash: string | null,
  sequenceNumber: number
): Promise<string> {
  const actionId = `action_${handId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  await db.insert(actions).values({
    id: actionId,
    handId,
    playerId,
    actionType,
    amount,
    stateHash: stateHash || null,
    sequenceNumber,
  });
  
  return actionId;
}

/**
 * Save a thought to the database
 */
export async function saveThought(
  thought: ThoughtRecord,
  actionId?: string
): Promise<void> {
  const thoughtId = `thought_${thought.gameId}_${thought.turn}_${thought.agentId}_${Date.now()}`;
  
  await db.insert(thoughts).values({
    id: thoughtId,
    actionId: actionId || null,
    agentId: thought.agentId,
    gameId: thought.gameId,
    turn: thought.turn,
    stateHash: thought.stateHash,
    thoughts: thought.thoughts,
    action: thought.action,
    amount: thought.amount,
    confidence: thought.confidence,
    signature: thought.signature,
  });
}

/**
 * Save a transaction to the database
 */
export async function saveTransaction(tx: TransactionRecord): Promise<void> {
  try {
    // Get player address from game state if needed
    const fromAddress = tx.from;
    const toAddress = tx.to === "pot" ? "pot" : tx.to;
    
    await db
      .insert(transactions)
      .values({
        id: tx.id,
        gameId: tx.gameId || null,
        fromAddress,
        toAddress,
        amount: tx.amount, // Schema uses bigint with mode: "number", so pass as number
        type: tx.type,
        txHash: tx.txHash || null,
        facilitatorReceipt: null,
        status: tx.status,
      })
      .onConflictDoUpdate({
        target: transactions.id,
        set: {
          status: tx.status,
          txHash: tx.txHash || null,
        },
      });
  } catch (error) {
    console.error("Error saving transaction:", error);
    throw error;
  }
}

/**
 * Get game from database
 */
export async function getGameFromDB(gameId: string) {
  const result = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  return result[0] || null;
}

/**
 * Get all games from database with full GameState
 * Returns games with full state, or constructs minimal state from DB columns
 */
export async function getAllGamesFromDB(limit = 100): Promise<GameState[]> {
  const result = await db
    .select()
    .from(games)
    .orderBy(desc(games.createdAt))
    .limit(limit);
  
  // Return full GameState from the gameState column, or construct minimal one
  return result.map(g => {
    if (g.gameState) {
      // Has full state - return it with createdAt/updatedAt and creatorAddress from DB
      const state = g.gameState as unknown as GameState;
      return {
        ...state,
        createdAt: g.createdAt?.getTime() || state.createdAt,
        updatedAt: g.updatedAt?.getTime() || state.updatedAt,
        creatorAddress: g.creatorAddress || state.creatorAddress,
      };
    }
    
    // Construct minimal state from database columns
    return {
      gameId: g.id,
      stage: g.stage as GameState["stage"],
      players: [],
      pot: 0,
      communityCards: [],
      currentBet: 0,
      dealerIndex: 0,
      currentPlayerIndex: 0,
      smallBlind: g.smallBlind,
      bigBlind: g.bigBlind,
      stateNonce: 0,
      stateHash: "",
      handNumber: g.handNumber,
      createdAt: g.createdAt?.getTime() || Date.now(),
      updatedAt: g.updatedAt?.getTime() || Date.now(),
      creatorAddress: g.creatorAddress || undefined,
    };
  });
}

/**
 * Get thoughts for a game from database
 */
export async function getThoughtsFromDB(gameId: string, limit = 50) {
  const result = await db
    .select()
    .from(thoughts)
    .where(eq(thoughts.gameId, gameId))
    .orderBy(desc(thoughts.timestamp))
    .limit(limit);
  
  return result.map((t) => ({
    agentId: t.agentId,
    gameId: t.gameId,
    turn: t.turn,
    stateHash: t.stateHash,
    thoughts: t.thoughts,
    action: t.action,
    amount: t.amount,
    confidence: t.confidence,
    timestamp: t.timestamp.getTime(),
    signature: t.signature,
  }));
}

/**
 * Get transactions for a game from database
 */
export async function getTransactionsFromDB(gameId: string, limit = 100) {
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.gameId, gameId))
    .orderBy(desc(transactions.timestamp))
    .limit(limit);
  
  return result.map((t) => ({
    id: t.id,
    gameId: t.gameId || undefined,
    from: t.fromAddress,
    to: t.toAddress,
    amount: Number(t.amount),
    type: t.type,
    txHash: t.txHash || undefined,
    timestamp: t.timestamp.getTime(),
    status: t.status,
  }));
}

