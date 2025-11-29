/**
 * Game Action API
 * 
 * POST /api/game/[gameId]/action - Submit a player action
 */

import { NextRequest, NextResponse } from "next/server";
import { gameCoordinator } from "@/lib/game-coordinator";
import type { ThoughtRecord, ActionType } from "@/types";

interface ActionRequest {
  thought: ThoughtRecord;
  facilitatorReceipt?: string;
  agentPubkey?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body: ActionRequest = await request.json();
    const { thought, facilitatorReceipt } = body;
    
    // Validate request
    if (!thought || !thought.agentId || !thought.action) {
      return NextResponse.json(
        { error: "Invalid action request" },
        { status: 400 }
      );
    }
    
    // Get current game state
    const gameState = gameCoordinator.getGame(gameId);
    if (!gameState) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }
    
    // Verify it's the agent's turn
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.id !== thought.agentId) {
      return NextResponse.json(
        { error: "Not your turn" },
        { status: 400 }
      );
    }
    
    // Verify state hash matches (prevents stale actions)
    if (thought.stateHash && thought.stateHash !== gameState.stateHash) {
      return NextResponse.json(
        { error: "State hash mismatch - game state has changed" },
        { status: 409 }
      );
    }
    
    // Process the action
    const result = await gameCoordinator.processAction(
      gameId,
      thought.agentId,
      thought.action as ActionType,
      thought.amount,
      thought,
      facilitatorReceipt
    );
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      newState: result.newState,
      txHash: result.txHash,
    });
  } catch (error) {
    console.error("[API] Error processing action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process action" },
      { status: 500 }
    );
  }
}

