/**
 * Start Game API
 * 
 * POST /api/game/[gameId]/start - Start a new hand
 */

import { NextRequest, NextResponse } from "next/server";
import { gameCoordinator } from "@/lib/game-coordinator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    
    // Get optional seed from request (for commit-reveal)
    const body = await request.json().catch(() => ({}));
    const { seed } = body;
    
    const result = await gameCoordinator.startHand(gameId, seed);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      gameState: result.gameState,
    });
  } catch (error) {
    console.error("[API] Error starting hand:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start hand" },
      { status: 500 }
    );
  }
}

