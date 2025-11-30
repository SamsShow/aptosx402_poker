/**
 * Account Balance API
 * 
 * GET /api/account/balance?address=0x...
 * 
 * Proxies balance requests to use Geomi API key server-side
 */

import { NextRequest, NextResponse } from "next/server";

// Mark as dynamic to allow searchParams
export const dynamic = 'force-dynamic';
import { aptosClient } from "@/lib/aptos-client";
import { AccountAddress } from "@aptos-labs/ts-sdk";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get("address");
    
    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      );
    }
    
    // Use server-side aptosClient which has API key configured
    const balance = await aptosClient.getAccountAPTAmount({
      accountAddress: AccountAddress.from(address),
    });
    
    return NextResponse.json({
      success: true,
      balance: Number(balance),
      balanceInAPT: Number(balance) / 100_000_000,
    });
  } catch (error) {
    console.error("[API] Error fetching balance:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to fetch balance",
        success: false 
      },
      { status: 500 }
    );
  }
}

