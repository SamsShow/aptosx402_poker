/**
 * Sync Balances API
 * 
 * POST /api/game/[gameId]/sync-balances - Sync player stacks with real APT wallet balances
 * GET /api/game/[gameId]/sync-balances - Get current wallet balances for all players
 */

import { NextRequest, NextResponse } from "next/server";
import { gameCoordinator } from "@/lib/game-coordinator";
import { walletManager } from "@/lib/wallet-manager";
import { updatePlayerStacks, validatePlayerBalances } from "@/lib/poker/engine";
import { APT_CONVERSION, octasToChips, formatChipsAsApt } from "@/lib/poker/constants";

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
    
    // Ensure wallet manager is initialized
    if (!walletManager.isInitialized()) {
      await walletManager.initialize();
    }
    
    // Fetch real-time wallet balances for all players (use cache to avoid rate limits)
    const walletInfos = await walletManager.getAllWalletInfos(false);
    
    // Build response with current balances
    const playerBalances = gameState.players.map((player) => {
      const walletInfo = walletInfos[player.id];
      const balanceOctas = walletInfo?.balance || 0;
      const balanceChips = octasToChips(balanceOctas);
      const minRequired = APT_CONVERSION.MIN_BALANCE_CHIPS;
      
      return {
        id: player.id,
        name: player.name,
        address: player.address,
        currentStack: player.stack,
        walletBalance: {
          octas: balanceOctas,
          chips: balanceChips,
          apt: walletInfo?.balanceApt || 0,
          formatted: formatChipsAsApt(balanceChips),
        },
        hasSufficientFunds: balanceChips >= minRequired,
        needsFunding: balanceChips < minRequired,
        fundingGap: Math.max(0, minRequired - balanceChips),
      };
    });
    
    const allFunded = playerBalances.every(p => p.hasSufficientFunds);
    const fundedCount = playerBalances.filter(p => p.hasSufficientFunds).length;
    
    return NextResponse.json({
      success: true,
      gameId,
      stage: gameState.stage,
      minRequired: {
        chips: APT_CONVERSION.MIN_BALANCE_CHIPS,
        octas: APT_CONVERSION.MIN_BALANCE_OCTAS,
        apt: APT_CONVERSION.MIN_BALANCE_OCTAS / APT_CONVERSION.OCTAS_PER_APT,
      },
      players: playerBalances,
      summary: {
        totalPlayers: playerBalances.length,
        fundedPlayers: fundedCount,
        allFunded,
        canStartGame: allFunded && gameState.stage === "waiting",
      },
    });
  } catch (error) {
    console.error("[API] Error fetching balances:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch balances" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    
    // Can only sync balances when game is waiting to start
    if (gameState.stage !== "waiting" && gameState.stage !== "settled") {
      return NextResponse.json(
        { error: "Cannot sync balances while game is in progress" },
        { status: 400 }
      );
    }
    
    // Ensure wallet manager is initialized
    if (!walletManager.isInitialized()) {
      await walletManager.initialize();
    }
    
    // Fetch real-time wallet balances (force refresh on POST)
    const walletInfos = await walletManager.getAllWalletInfos(true);
    
    // Build wallet balances map (in octas)
    const walletBalances: Record<string, number> = {};
    for (const [agentId, info] of Object.entries(walletInfos)) {
      walletBalances[agentId] = info.balance;
    }
    
    // Update player stacks with real balances
    const updatedState = updatePlayerStacks(gameState, walletBalances);
    
    // Validate balances
    const validation = validatePlayerBalances(updatedState);
    
    // Update the game in the coordinator
    // We need to directly update the coordinator's game state
    const session = (gameCoordinator as any).games.get(gameId);
    if (session) {
      session.state = updatedState;
    }
    
    // Build response
    const playerBalances = updatedState.players.map((player) => {
      const walletInfo = walletInfos[player.id];
      
      return {
        id: player.id,
        name: player.name,
        previousStack: gameState.players.find(p => p.id === player.id)?.stack || 0,
        newStack: player.stack,
        walletBalanceApt: walletInfo?.balanceApt || 0,
        hasSufficientFunds: player.stack >= APT_CONVERSION.MIN_BALANCE_CHIPS,
      };
    });
    
    return NextResponse.json({
      success: true,
      gameId,
      message: "Player stacks synced with wallet balances",
      validation: {
        valid: validation.valid,
        minRequired: validation.minRequired,
        underfundedPlayers: validation.underfundedPlayers,
      },
      players: playerBalances,
      canStartGame: validation.valid,
      gameState: updatedState,
    });
  } catch (error) {
    console.error("[API] Error syncing balances:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync balances" },
      { status: 500 }
    );
  }
}

