/**
 * Sponsorship Database Operations
 * 
 * Handles recording and querying sponsor contributions to agents
 */

import { db, sponsorships, sponsorTotals, sql } from "./index";
import { eq, desc } from "drizzle-orm";

/**
 * Record a new sponsorship contribution
 */
export async function recordSponsorship(
  sponsorAddress: string,
  agentId: string,
  amount: number,
  txHash?: string,
  gameId?: string
): Promise<string> {
  const id = `sponsor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const normalizedAddress = sponsorAddress.toLowerCase();
  const totalId = `${normalizedAddress}_${agentId}`;
  
  try {
    // Insert sponsorship record
    await db.insert(sponsorships).values({
      id,
      sponsorAddress: normalizedAddress,
      agentId,
      amount,
      txHash,
      gameId,
      status: "confirmed",
    });
    
    // Check if totals record exists
    const existingTotal = await db
      .select()
      .from(sponsorTotals)
      .where(eq(sponsorTotals.id, totalId))
      .limit(1);
    
    if (existingTotal.length > 0) {
      // Update existing totals
      await db
        .update(sponsorTotals)
        .set({
          totalAmount: existingTotal[0].totalAmount + amount,
          contributionCount: existingTotal[0].contributionCount + 1,
          lastContribution: new Date(),
        })
        .where(eq(sponsorTotals.id, totalId));
    } else {
      // Create new totals record
      await db.insert(sponsorTotals).values({
        id: totalId,
        sponsorAddress: normalizedAddress,
        agentId,
        totalAmount: amount,
        contributionCount: 1,
      });
    }
    
    console.log(`[SponsorshipDB] Recorded sponsorship: ${sponsorAddress} -> ${agentId} (${amount} octas)`);
    return id;
  } catch (error) {
    console.error("[SponsorshipDB] Error recording sponsorship:", error);
    throw error;
  }
}

/**
 * Get all sponsorships for an agent
 */
export async function getAgentSponsorships(agentId: string, limit = 50): Promise<typeof sponsorships.$inferSelect[]> {
  try {
    return await db
      .select()
      .from(sponsorships)
      .where(eq(sponsorships.agentId, agentId))
      .orderBy(desc(sponsorships.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[SponsorshipDB] Error getting agent sponsorships:", error);
    return [];
  }
}

/**
 * Get all sponsors for an agent (aggregated)
 */
export async function getAgentSponsors(agentId: string): Promise<typeof sponsorTotals.$inferSelect[]> {
  try {
    return await db
      .select()
      .from(sponsorTotals)
      .where(eq(sponsorTotals.agentId, agentId))
      .orderBy(desc(sponsorTotals.totalAmount));
  } catch (error) {
    console.error("[SponsorshipDB] Error getting agent sponsors:", error);
    return [];
  }
}

/**
 * Get sponsorship history for a wallet address
 */
export async function getSponsorHistory(sponsorAddress: string, limit = 50): Promise<typeof sponsorships.$inferSelect[]> {
  try {
    return await db
      .select()
      .from(sponsorships)
      .where(eq(sponsorships.sponsorAddress, sponsorAddress.toLowerCase()))
      .orderBy(desc(sponsorships.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[SponsorshipDB] Error getting sponsor history:", error);
    return [];
  }
}

/**
 * Get sponsor totals for a wallet address
 */
export async function getSponsorTotals(sponsorAddress: string): Promise<typeof sponsorTotals.$inferSelect[]> {
  try {
    return await db
      .select()
      .from(sponsorTotals)
      .where(eq(sponsorTotals.sponsorAddress, sponsorAddress.toLowerCase()))
      .orderBy(desc(sponsorTotals.totalAmount));
  } catch (error) {
    console.error("[SponsorshipDB] Error getting sponsor totals:", error);
    return [];
  }
}

/**
 * Get total funding received by an agent
 */
export async function getAgentTotalFunding(agentId: string): Promise<{ totalAmount: number; sponsorCount: number }> {
  try {
    const sponsors = await getAgentSponsors(agentId);
    const totalAmount = sponsors.reduce((sum, s) => sum + s.totalAmount, 0);
    const sponsorCount = sponsors.length;
    return { totalAmount, sponsorCount };
  } catch (error) {
    console.error("[SponsorshipDB] Error getting agent total funding:", error);
    return { totalAmount: 0, sponsorCount: 0 };
  }
}

/**
 * Get sponsorships for a specific game
 */
export async function getGameSponsorships(gameId: string): Promise<typeof sponsorships.$inferSelect[]> {
  try {
    return await db
      .select()
      .from(sponsorships)
      .where(eq(sponsorships.gameId, gameId))
      .orderBy(desc(sponsorships.createdAt));
  } catch (error) {
    console.error("[SponsorshipDB] Error getting game sponsorships:", error);
    return [];
  }
}

