/**
 * Fund Agent API
 * 
 * POST /api/agents/[agentId]/fund - Fund an agent from faucet
 */

import { NextRequest, NextResponse } from "next/server";
import { walletManager } from "@/lib/wallet-manager";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const body = await request.json().catch(() => ({}));
    const amount = body.amount || 100_000_000; // Default 1 APT
    
    // Ensure wallet manager is initialized
    if (!walletManager.isInitialized()) {
      await walletManager.initialize();
    }
    
    const success = await walletManager.fundFromFaucet(agentId, amount);
    
    if (!success) {
      return NextResponse.json(
        { error: "Failed to fund agent" },
        { status: 400 }
      );
    }
    
    const walletInfo = await walletManager.getWalletInfo(agentId);
    
    return NextResponse.json({
      success: true,
      walletInfo,
    });
  } catch (error) {
    console.error("[API] Error funding agent:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fund agent" },
      { status: 500 }
    );
  }
}
