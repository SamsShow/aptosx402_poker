/**
 * API Route: Game Wallet Status
 * 
 * GET /api/game-wallets/status?gameId=xxx
 * Get funding status for all wallets in a game
 */

import { NextRequest, NextResponse } from "next/server";
import { gameWalletManager } from "@/lib/game-wallet-manager";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const gameId = searchParams.get("gameId");
        const requiredAmountStr = searchParams.get("requiredAmount");

        if (!gameId) {
            return NextResponse.json(
                { error: "gameId is required" },
                { status: 400 }
            );
        }

        const requiredAmount = requiredAmountStr
            ? parseInt(requiredAmountStr, 10)
            : 100_000_000; // Default 1 APT

        // Get all wallet infos
        const wallets = await gameWalletManager.getGameWalletInfos(gameId, requiredAmount);

        // Get funding records
        const fundingRecords = await gameWalletManager.getFundingRecords(gameId);

        // Check if all wallets are funded
        const allFunded = wallets.every(w => w.funded);
        const totalRequired = wallets.length * requiredAmount;
        const totalFunded = wallets.reduce((sum, w) => sum + w.balance, 0);

        return NextResponse.json({
            success: true,
            wallets,
            fundingRecords,
            summary: {
                totalWallets: wallets.length,
                fundedWallets: wallets.filter(w => w.funded).length,
                allFunded,
                totalRequired,
                totalFunded,
                progress: totalRequired > 0 ? (totalFunded / totalRequired) * 100 : 0,
            },
        });
    } catch (error) {
        console.error("[API] Game wallet status error:", error);
        return NextResponse.json(
            {
                error: "Failed to get wallet status",
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
