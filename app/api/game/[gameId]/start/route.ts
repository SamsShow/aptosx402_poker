/**
 * Start Game API
 * 
 * POST /api/game/[gameId]/start - Start a new hand
 * 
 * Before starting, this endpoint:
 * 1. Syncs player stacks with real APT wallet balances
 * 2. Validates all players have sufficient funding
 * 3. Starts the hand only if all conditions are met
 */

import { NextRequest, NextResponse } from "next/server";
import { gameCoordinator } from "@/lib/game-coordinator";
import { walletManager } from "@/lib/wallet-manager";
import { updatePlayerStacks, validatePlayerBalances } from "@/lib/poker/engine";
import { APT_CONVERSION } from "@/lib/poker/constants";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    
    // Get optional parameters from request
    const body = await request.json().catch(() => ({}));
    const { seed, skipFundingCheck = false } = body;
    
    // Get current game state
    let gameState = gameCoordinator.getGame(gameId);
    if (!gameState) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }
    
    // Ensure wallet manager is initialized
    if (!walletManager.isInitialized()) {
      await walletManager.initialize();
    }
    
    // Fetch real-time wallet balances
    const walletInfos = await walletManager.getAllWalletInfos();
    
    // Build wallet balances map (in octas)
    const walletBalances: Record<string, number> = {};
    for (const [agentId, info] of Object.entries(walletInfos)) {
      walletBalances[agentId] = info.balance;
    }
    
    // Update player stacks with real balances
    const updatedState = updatePlayerStacks(gameState, walletBalances);
    
    // Validate balances
    const validation = validatePlayerBalances(updatedState);
    
    // If not all players have sufficient funds, return error (unless skipping check)
    if (!validation.valid && !skipFundingCheck) {
      return NextResponse.json({
        success: false,
        error: "Not all players have sufficient funding",
        needsFunding: true,
        validation: {
          valid: validation.valid,
          minRequired: validation.minRequired,
          minRequiredApt: APT_CONVERSION.MIN_BALANCE_OCTAS / APT_CONVERSION.OCTAS_PER_APT,
          underfundedPlayers: validation.underfundedPlayers,
        },
        message: `${validation.underfundedPlayers.length} player(s) need funding before the game can start.`,
      }, { status: 400 });
    }
    
    // Update the game state in coordinator with synced balances
    const session = (gameCoordinator as any).games.get(gameId);
    if (session) {
      session.state = updatedState;
    }
    
    // Start the hand
    const result = await gameCoordinator.startHand(gameId, seed);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      gameState: result.newState,
      balancesSynced: true,
      playerStacks: result.newState?.players.map(p => ({
        id: p.id,
        name: p.name,
        stack: p.stack,
        walletBalanceApt: walletInfos[p.id]?.balanceApt || 0,
      })),
    });
  } catch (error) {
    console.error("[API] Error starting hand:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start hand" },
      { status: 500 }
    );
  }
}

