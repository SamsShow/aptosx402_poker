/**
 * Game Management API
 * 
 * POST /api/game - Create a new game
 * GET /api/game - List all games (from memory + database)
 */

import { NextRequest, NextResponse } from "next/server";
import { createGame } from "@/lib/poker/engine";
import { AGENT_CONFIGS } from "@/types/agents";
import { gameCoordinator } from "@/lib/game-coordinator";
import { walletManager } from "@/lib/wallet-manager";
import { getAllGamesFromDB } from "@/lib/db/game-db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smallBlind = 5, bigBlind = 10, agentIds, creatorAddress } = body;

    // Ensure wallet manager is initialized to get real wallet addresses
    if (!walletManager.isInitialized()) {
      await walletManager.initialize();
    }

    // Get agent addresses
    const agentAddresses = walletManager.getAgentAddresses();

    // Get agent configurations
    const agents = (agentIds || Object.keys(AGENT_CONFIGS)).slice(0, 5);

    const players = agents.map((agentId: string) => {
      const config = AGENT_CONFIGS[agentId as keyof typeof AGENT_CONFIGS];
      if (!config) {
        throw new Error(`Unknown agent: ${agentId}`);
      }

      // Use real wallet address from walletManager
      const address = agentAddresses[config.id] || `0x${config.id.slice(-8).repeat(5)}`;

      return {
        id: config.id,
        address,
        name: config.name,
        model: config.model,
        avatar: config.avatar,
      };
    });

    // Create game state with 0 chips for all players
    // Players must be funded explicitly before the game can start
    const gameState = createGame(players, {
      smallBlind,
      bigBlind,
      // Don't pass walletBalances - start everyone at 0
    });

    // Register with coordinator (saves to database with creator address)
    // Note: buyIn parameter is now 0 since we use real balances
    await gameCoordinator.registerGame(gameState, 0, smallBlind, bigBlind, creatorAddress);

    // Create per-game wallets for all agents
    let gameWallets: Array<{
      agentId: string;
      agentName: string;
      address: string;
      publicKey: string;
      balance: number;
      balanceApt: number;
      initialFunding: number;
      requiredAmount: number;
      funded: boolean;
    }> = [];
    try {
      const { gameWalletManager } = await import("@/lib/game-wallet-manager");
      const agentIdList = players.map((p: any) => p.id);
      const requiredAmount = bigBlind * 100 * 10_000; // 100 big blinds in octas
      gameWallets = await gameWalletManager.createGameWallets(
        gameState.gameId,
        agentIdList,
        requiredAmount
      );
      console.log(`[API] Created ${gameWallets.length} game wallets for game ${gameState.gameId}`);
    } catch (error) {
      console.error("[API] Failed to create game wallets:", error);
      // Continue anyway - wallets can be created later if needed
    }

    return NextResponse.json({
      success: true,
      gameId: gameState.gameId,
      gameState,
      // Include game wallets in response
      gameWallets: gameWallets.map(w => ({
        agentId: w.agentId,
        agentName: w.agentName,
        address: w.address,
        requiredAmount: w.requiredAmount,
        funded: w.funded,
      })),
      // Include funding status in response
      fundingStatus: {
        totalPlayers: gameState.players.length,
        fundedPlayers: gameState.players.filter(p => p.stack > 0).length,
        needsFunding: gameState.players.some(p => p.stack === 0),
        walletsCreated: gameWallets.length > 0,
      },
    });
  } catch (error) {
    console.error("[API] Error creating game:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create game" },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if we want only active games (default: show all)
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    // Get games from memory (active sessions)
    const memoryGames = gameCoordinator.getAllGames();

    // Get games from database (persisted games from all users)
    let dbGames: typeof memoryGames = [];
    try {
      dbGames = await getAllGamesFromDB(100); // Increased limit
    } catch (error) {
      console.error("[API] Error fetching games from DB:", error);
      // Continue with memory games only
    }

    // Merge: prefer memory games (they're more up-to-date), add DB games not in memory
    const memoryGameIds = new Set(memoryGames.map(g => g.gameId));
    const allGames = [
      ...memoryGames,
      ...dbGames.filter(g => !memoryGameIds.has(g.gameId))
    ];

    // Sort by creation time (newest first)
    allGames.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Filter by active if requested
    const filteredGames = activeOnly
      ? allGames.filter(g => g.stage !== "settled")
      : allGames;

    return NextResponse.json({
      success: true,
      count: filteredGames.length,
      games: filteredGames.map((g) => ({
        gameId: g.gameId,
        stage: g.stage,
        playerCount: g.players?.length || 0,
        pot: g.pot || 0,
        handNumber: g.handNumber || 0,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
        creatorAddress: g.creatorAddress,
        players: (g.players || []).map((p) => ({
          id: p.id,
          name: p.name,
          stack: p.stack,
          folded: p.folded,
        })),
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
