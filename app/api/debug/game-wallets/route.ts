/**
 * API Route: Verify Game Wallets
 * 
 * GET /api/debug/game-wallets?gameId=xxx
 * Check if per-game wallets exist
 */

import { NextRequest, NextResponse } from "next/server";
import { gameWalletManager } from "@/lib/game-wallet-manager";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const gameId = searchParams.get("gameId");

        if (!gameId) {
            return NextResponse.json(
                { error: "gameId is required" },
                { status: 400 }
            );
        }

        // Try to get game wallets
        const wallets = await gameWalletManager.getGameWalletInfos(gameId);

        return NextResponse.json({
            success: true,
            gameId,
            walletCount: wallets.length,
            wallets: wallets.map(w => ({
                agentId: w.agentId,
                agentName: w.agentName,
                address: w.address,
                balance: w.balance,
                funded: w.funded,
            })),
            systemWorking: wallets.length > 0,
            message: wallets.length > 0
                ? "Per-game wallets ARE working!"
                : "Per-game wallets NOT created for this game"
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to check wallets",
            details: String(error),
            likelyIssue: "Database table 'game_agent_wallets' may not exist. Run migration first."
        }, { status: 500 });
    }
}
