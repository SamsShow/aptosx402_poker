/**
 * Game Management API
 * 
 * POST /api/game - Create a new game
 * GET /api/game - List active games
 */

import { NextRequest, NextResponse } from "next/server";
import { createGame } from "@/lib/poker/engine";
import { AGENT_CONFIGS } from "@/types/agents";
import { gameCoordinator } from "@/lib/game-coordinator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { buyIn = 1000, smallBlind = 5, bigBlind = 10, agentIds } = body;
    
    // Get agent configurations
    const agents = (agentIds || Object.keys(AGENT_CONFIGS)).slice(0, 5);
    
    const players = agents.map((agentId: string) => {
      const config = AGENT_CONFIGS[agentId as keyof typeof AGENT_CONFIGS];
      if (!config) {
        throw new Error(`Unknown agent: ${agentId}`);
      }
      return {
        id: config.id,
        address: `0x${config.id.slice(-8).repeat(5)}`, // Mock address for now
        name: config.name,
        model: config.model,
        avatar: config.avatar,
      };
    });
    
    // Create game state
    const gameState = createGame(players, { buyIn, smallBlind, bigBlind });
    
    // Register with coordinator
    gameCoordinator.registerGame(gameState);
    
    return NextResponse.json({
      success: true,
      gameId: gameState.gameId,
      gameState,
    });
  } catch (error) {
    console.error("[API] Error creating game:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create game" },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    const games = gameCoordinator.getActiveGames();
    
    return NextResponse.json({
      success: true,
      games: games.map((g) => ({
        gameId: g.gameId,
        stage: g.stage,
        playerCount: g.players.length,
        pot: g.pot,
        handNumber: g.handNumber,
      })),
    });
  } catch (error) {
    console.error("[API] Error listing games:", error);
    return NextResponse.json(
      { error: "Failed to list games" },
      { status: 500 }
    );
  }
}

