/**
 * Settlement Debug API
 * 
 * GET /api/game/[gameId]/settlement-debug - Get settlement debugging information
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

    const history = gameCoordinator.getHistory(gameId);
    const transactions = gameCoordinator.getTransactions(gameId);
    
    const latestHand = Array.isArray(history) && history.length > 0 
      ? history[history.length - 1] 
      : null;

    const settlementTxs = transactions.filter(
      tx => tx.type === "settlement" && tx.status === "confirmed" && tx.txHash && tx.txHash !== "pending_settlement"
    );

    const pendingBets = transactions.filter(
      tx => tx.type === "bet" && tx.status === "pending"
    );

    let debugInfo: any = {
      gameStage: gameState.stage,
      handNumber: gameState.handNumber,
      pot: gameState.pot,
      settlementTxsCount: settlementTxs.length,
      pendingBetsCount: pendingBets.length,
    };

    if (latestHand) {
      const winners = latestHand.winners || [];
      const losers = latestHand.actions
        ?.filter(a => a.amount > 0 && !winners.includes(a.playerId))
        .map(a => ({ playerId: a.playerId, amount: a.amount })) || [];

      debugInfo.latestHand = {
        handNumber: latestHand.handNumber,
        winners: winners.length > 0 ? winners : "NONE",
        winnersCount: winners.length,
        actionsCount: latestHand.actions?.length || 0,
        losers: losers,
        losersCount: losers.length,
        startStatePot: latestHand.startState?.pot || 0,
        endStatePot: latestHand.endState?.pot || 0,
      };

      // Check if winners determination would work
      if (gameState.stage === "settled") {
        const playersWhoGainedChips = gameState.players
          .filter((p) => {
            const startPlayer = latestHand.startState?.players?.find(sp => sp.id === p.id);
            return startPlayer && p.stack > startPlayer.stack;
          })
          .map((p) => p.id);
        
        const nonFolded = gameState.players
          .filter((p) => !p.folded)
          .map((p) => p.id);

        debugInfo.winnerDetermination = {
          playersWhoGainedChips,
          nonFoldedPlayers: nonFolded,
          wouldDetermineWinners: playersWhoGainedChips.length > 0 ? playersWhoGainedChips : nonFolded,
        };
      }
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo,
    });
  } catch (error) {
    console.error("[API] Error getting settlement debug:", error);
    return NextResponse.json(
      { error: "Failed to get settlement debug info" },
      { status: 500 }
    );
  }
}

