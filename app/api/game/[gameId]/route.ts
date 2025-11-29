/**
 * Individual Game API
 * 
 * GET /api/game/[gameId] - Get game state
 * DELETE /api/game/[gameId] - End/delete game
 */

import { NextRequest, NextResponse } from "next/server";
import { gameCoordinator } from "@/lib/game-coordinator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const gameState = gameCoordinator.getGame(gameId);
    
    if (!gameState) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }
    
    // Get associated thoughts and transactions
    const thoughts = gameCoordinator.getThoughts(gameId);
    const transactions = gameCoordinator.getTransactions(gameId);
    
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

