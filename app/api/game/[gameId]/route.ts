/**
 * Individual Game API
 * 
 * GET /api/game/[gameId] - Get game state
 * DELETE /api/game/[gameId] - End/delete game
 */

import { NextRequest, NextResponse } from "next/server";
import { gameCoordinator } from "@/lib/game-coordinator";
import { getGameFromDB, getThoughtsFromDB, getTransactionsFromDB } from "@/lib/db/game-db";
import type { ThoughtRecord, TransactionRecord } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    
    // First check memory (active games)
    let gameState = gameCoordinator.getGame(gameId);
    
    // If not in memory, try to load from database
    if (!gameState) {
      try {
        const dbGame = await getGameFromDB(gameId);
        if (dbGame && dbGame.gameState) {
          // Restore game state from database
          const restoredState = dbGame.gameState as unknown as typeof gameState;
          
          if (restoredState) {
            gameState = restoredState;
            
            // Register it back in memory so it's available
            const config = {
              buyIn: dbGame.buyIn || 1000,
              smallBlind: dbGame.smallBlind || 5,
              bigBlind: dbGame.bigBlind || 10,
            };
            await gameCoordinator.registerGame(
              gameState,
              config.buyIn,
              config.smallBlind,
              config.bigBlind,
              dbGame.creatorAddress || undefined
            );
          }
        }
      } catch (dbError) {
        console.error("[API] Error loading game from DB:", dbError);
      }
    }
    
    if (!gameState) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }
    
    // Get associated thoughts and transactions
    let thoughts: ThoughtRecord[] = gameCoordinator.getThoughts(gameId);
    let transactions: TransactionRecord[] = gameCoordinator.getTransactions(gameId);
    
    // If empty, try loading from database
    if (thoughts.length === 0) {
      try {
        const dbThoughts = await getThoughtsFromDB(gameId);
        thoughts = dbThoughts as ThoughtRecord[];
      } catch (error) {
        console.error("[API] Error loading thoughts from DB:", error);
      }
    }
    
    if (transactions.length === 0) {
      try {
        const dbTransactions = await getTransactionsFromDB(gameId);
        transactions = dbTransactions as TransactionRecord[];
      } catch (error) {
        console.error("[API] Error loading transactions from DB:", error);
      }
    }
    
    return NextResponse.json({
      success: true,
      gameState,
      thoughts,
      transactions,
    });
  } catch (error) {
    console.error("[API] Error getting game:", error);
    return NextResponse.json(
      { error: "Failed to get game" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    gameCoordinator.endGame(gameId);
    
    return NextResponse.json({
      success: true,
      message: "Game ended",
    });
  } catch (error) {
    console.error("[API] Error ending game:", error);
    return NextResponse.json(
      { error: "Failed to end game" },
      { status: 500 }
    );
  }
}

