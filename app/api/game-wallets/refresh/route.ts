/**
 * API Route: Refresh Game Wallet Balances
 * 
 * POST /api/game-wallets/refresh
 * Refreshes wallet balances from blockchain
 */

import { NextRequest, NextResponse } from "next/server";
import { gameWalletManager } from "@/lib/game-wallet-manager";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { gameId } = body;

        if (!gameId) {
            return NextResponse.json(
                { error: "gameId is required" },
                { status: 400 }
            );
        }

        // Refresh balances from blockchain
        await gameWalletManager.refreshWalletBalances(gameId);

        // Get updated wallet infos
        const wallets = await gameWalletManager.getGameWalletInfos(gameId);

        return NextResponse.json({
            success: true,
            wallets,
        });
    } catch (error) {
        console.error("[API] Refresh wallet balances error:", error);
        return NextResponse.json(
            {
                error: "Failed to refresh balances",
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
