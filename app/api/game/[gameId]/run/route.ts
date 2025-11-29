/**
 * Run Game Loop API
 * 
 * POST /api/game/[gameId]/run - Start autonomous game loop
 * DELETE /api/game/[gameId]/run - Stop game loop
 */

import { NextRequest, NextResponse } from "next/server";
import { gameLoop } from "@/agents/game-loop";
import { gameCoordinator } from "@/lib/game-coordinator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json().catch(() => ({}));
    
    const {
      turnDelay = 2000,
      handDelay = 5000,
      maxHands = 100,
    } = body;
    
    // Check if game exists
    const gameState = gameCoordinator.getGame(gameId);
    if (!gameState) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }
    
    // Check if already running
    if (gameLoop.isActive() && gameLoop.getCurrentGameId() === gameId) {
      return NextResponse.json(
        { error: "Game loop already running" },
        { status: 400 }
      );
    }
    
    // Start game loop in background
    gameLoop.start({
      gameId,
      turnDelay,
      handDelay,
      maxHands,
      onThought: (thought) => {
        console.log(`[API] Agent ${thought.agentId} thought: ${thought.thoughts.slice(0, 50)}...`);
      },
      onStateChange: (state) => {
        console.log(`[API] Game state changed: stage=${state.stage}, pot=${state.pot}`);
      },
      onError: (error) => {
        console.error("[API] Game loop error:", error);
      },
    }).catch((error) => {
      console.error("[API] Game loop failed:", error);
    });
    
    return NextResponse.json({
      success: true,
      message: "Game loop started",
      gameId,
    });
  } catch (error) {
    console.error("[API] Error starting game loop:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start game loop" },
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
    
    if (gameLoop.getCurrentGameId() !== gameId) {
      return NextResponse.json(
        { error: "Game loop not running for this game" },
        { status: 400 }
      );
    }
    
    gameLoop.stop();
    
    return NextResponse.json({
      success: true,
      message: "Game loop stopped",
    });
  } catch (error) {
    console.error("[API] Error stopping game loop:", error);
    return NextResponse.json(
      { error: "Failed to stop game loop" },
      { status: 500 }
    );
  }
}

