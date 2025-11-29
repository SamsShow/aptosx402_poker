/**
 * Wallets API
 * 
 * GET /api/wallets - Get all agent wallets from database
 * POST /api/wallets/init - Initialize/create wallets for all agents
 */

import { NextRequest, NextResponse } from "next/server";
import { walletManager } from "@/lib/wallet-manager";

export async function GET() {
  try {
    // Get all wallets from database
    const wallets = await walletManager.getAllWalletsFromDB();
    
    // Don't expose private keys in response
    const sanitizedWallets = wallets.map(w => ({
      agentId: w.agentId,
      name: w.name,
      model: w.model,
      address: w.address,
      publicKey: w.publicKey,
      balance: w.balance,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
    
    return NextResponse.json({
      success: true,
      wallets: sanitizedWallets,
    });
  } catch (error) {
    console.error("[API] Error getting wallets:", error);
    return NextResponse.json(
      { error: "Failed to get wallets" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;
    
    if (action === "init" || action === "initialize") {
      // Initialize wallet manager (creates wallets if needed)
      await walletManager.initialize();
      
      const wallets = await walletManager.getAllWalletsFromDB();
      
      return NextResponse.json({
        success: true,
        message: "Wallets initialized",
        count: wallets.length,
      });
    }
    
    if (action === "fund_all") {
      // Fund all wallets from faucet
      if (!walletManager.isInitialized()) {
        await walletManager.initialize();
      }
      
      await walletManager.fundAllFromFaucet(body.amount || 100_000_000);
      
      return NextResponse.json({
        success: true,
        message: "All wallets funded",
      });
    }
    
    return NextResponse.json(
      { error: "Invalid action. Use 'init' or 'fund_all'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API] Error in wallets POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

