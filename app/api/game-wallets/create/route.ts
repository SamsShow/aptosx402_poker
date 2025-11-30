/**
 * API Route: Create Game Wallets
 * 
 * POST /api/game-wallets/create
 * Creates separate wallets for all agents in a game
 */

import { NextRequest, NextResponse } from "next/server";
import { gameWalletManager } from "@/lib/game-wallet-manager";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { gameId, agentIds, requiredAmount } = body;

        if (!gameId || !agentIds || !Array.isArray(agentIds)) {
            return NextResponse.json(
                { error: "gameId and agentIds array are required" },
                { status: 400 }
            );
        }

        // Create wallets for all agents
        const wallets = await gameWalletManager.createGameWallets(
            gameId,
            agentIds,
            requiredAmount || 100_000_000 // Default 1 APT
        );

        return NextResponse.json({
            success: true,
            wallets,
        });
    } catch (error) {
        console.error("[API] Create game wallets error:", error);
        return NextResponse.json(
            {
                error: "Failed to create game wallets",
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
