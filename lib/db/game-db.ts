/**
 * Game Database Operations
 * 
 * Handles persistence of games, hands, actions, thoughts, and transactions
 */

import { db, games, hands, actions, thoughts, transactions, type NewGame, type NewHand, type NewAction, type NewThought, type NewTransaction } from "./index";
import { eq, desc } from "drizzle-orm";
import type { GameState, ThoughtRecord, TransactionRecord } from "@/types";

/**
 * Save or update a game in the database
 */
export async function saveGame(gameState: GameState, buyIn: number, smallBlind: number, bigBlind: number): Promise<void> {
  try {
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
      })
      .onConflictDoUpdate({
        target: games.id,
        set: {
          stage: gameState.stage,
          handNumber: gameState.handNumber,
          totalHands: gameState.handNumber,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("[DB] Error saving game:", error);
    throw error;
  }
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
  try {
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
  } catch (error) {
    console.error("[DB] Error saving hand:", error);
    throw error;
  }
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
  try {
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
  } catch (error) {
    console.error("[DB] Error saving action:", error);
    throw error;
  }
}

/**
 * Save a thought to the database
 */
export async function saveThought(
  thought: ThoughtRecord,
  actionId?: string
): Promise<void> {
  try {
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
  } catch (error) {
    console.error("[DB] Error saving thought:", error);
    // Don't throw - thoughts are not critical for game flow
  }
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
        gameId: tx.gameId,
        fromAddress,
        toAddress,
        amount: BigInt(tx.amount),
        type: tx.type,
        txHash: tx.txHash || null,
        facilitatorReceipt: null,
        status: tx.status,
      })
      .onConflictDoUpdate({
        target: transactions.id,
        set: {
          status: tx.status,
          txHash: tx.txHash || undefined,
        },
      });
  } catch (error) {
    console.error("[DB] Error saving transaction:", error);
    // Don't throw - transactions are not critical for game flow
  }
}

/**
 * Get game from database
 */
export async function getGameFromDB(gameId: string) {
  try {
    const result = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[DB] Error getting game:", error);
    return null;
  }
}

/**
 * Get thoughts for a game from database
 */
export async function getThoughtsFromDB(gameId: string, limit = 50) {
  try {
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
  } catch (error) {
    console.error("[DB] Error getting thoughts:", error);
    return [];
  }
}

/**
 * Get transactions for a game from database
 */
export async function getTransactionsFromDB(gameId: string, limit = 100) {
  try {
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
  } catch (error) {
    console.error("[DB] Error getting transactions:", error);
    return [];
  }
}

