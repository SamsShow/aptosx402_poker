/**
 * API Route: Fund Game Wallet
 * 
 * POST /api/game-wallets/fund
 * Records funding for a game-specific agent wallet
 */

import { NextRequest, NextResponse } from "next/server";
import { gameWalletManager } from "@/lib/game-wallet-manager";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { gameId, agentId, funderAddress, amount, txHash } = body;

        if (!gameId || !agentId || !funderAddress || !amount) {
            return NextResponse.json(
                { error: "gameId, agentId, funderAddress, and amount are required" },
                { status: 400 }
            );
        }

        // Record the funding
        const fundingId = await gameWalletManager.recordFunding(
            gameId,
            agentId,
            funderAddress,
            amount,
            txHash
        );

        // Get updated wallet info
        const wallets = await gameWalletManager.getGameWalletInfos(gameId);
        const walletInfo = wallets.find(w => w.agentId === agentId);

        return NextResponse.json({
            success: true,
            fundingId,
            wallet: walletInfo,
        });
    } catch (error) {
        console.error("[API] Fund game wallet error:", error);
        return NextResponse.json(
            {
                error: "Failed to record funding",
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
