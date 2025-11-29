/**
 * Agent Stats Database Operations
 * 
 * Handles persistence of agent statistics to the database
 */

import { db, agentStats } from "./index";
import { eq } from "drizzle-orm";

export interface AgentStatsData {
  agentId: string;
  totalHands: number;
  wins: number;
  winRate: number;
  totalWinnings: number;
  biggestPot: number;
}

/**
 * Get agent stats from database
 */
export async function getAgentStatsFromDB(agentId: string): Promise<AgentStatsData | null> {
  try {
    const results = await db
      .select()
      .from(agentStats)
      .where(eq(agentStats.agentId, agentId))
      .limit(1);
    
    if (results.length === 0) return null;
    
    const stats = results[0];
    return {
      agentId: stats.agentId,
      totalHands: stats.totalHands,
      wins: stats.wins,
      winRate: stats.totalHands > 0 ? stats.wins / stats.totalHands : 0,
      totalWinnings: stats.totalWinnings,
      biggestPot: stats.biggestPot,
    };
  } catch (error) {
    console.error(`[AgentStatsDB] Error getting stats for ${agentId}:`, error);
    return null;
  }
}

/**
 * Get all agent stats from database
 */
export async function getAllAgentStatsFromDB(): Promise<Record<string, AgentStatsData>> {
  try {
    const results = await db.select().from(agentStats);
    
    const statsMap: Record<string, AgentStatsData> = {};
    for (const stats of results) {
      statsMap[stats.agentId] = {
        agentId: stats.agentId,
        totalHands: stats.totalHands,
        wins: stats.wins,
        winRate: stats.totalHands > 0 ? stats.wins / stats.totalHands : 0,
        totalWinnings: stats.totalWinnings,
        biggestPot: stats.biggestPot,
      };
    }
    
    return statsMap;
  } catch (error) {
    console.error("[AgentStatsDB] Error getting all stats:", error);
    return {};
  }
}

/**
 * Record a hand result for an agent
 */
export async function recordAgentHandResult(
  agentId: string,
  won: boolean,
  potWon: number = 0
): Promise<void> {
  try {
    // Get current stats
    const current = await getAgentStatsFromDB(agentId);
    
    const newTotalHands = (current?.totalHands || 0) + 1;
    const newWins = (current?.wins || 0) + (won ? 1 : 0);
    const newTotalWinnings = (current?.totalWinnings || 0) + potWon;
    const newBiggestPot = Math.max(current?.biggestPot || 0, potWon);
    
    await db
      .insert(agentStats)
      .values({
        agentId,
        totalHands: newTotalHands,
        wins: newWins,
        totalWinnings: newTotalWinnings,
        biggestPot: newBiggestPot,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: agentStats.agentId,
        set: {
          totalHands: newTotalHands,
          wins: newWins,
          totalWinnings: newTotalWinnings,
          biggestPot: newBiggestPot,
          updatedAt: new Date(),
        },
      });
    
    console.log(`[AgentStatsDB] Recorded result for ${agentId}: won=${won}, pot=${potWon}`);
  } catch (error) {
    console.error(`[AgentStatsDB] Error recording result for ${agentId}:`, error);
  }
}

/**
 * Initialize stats for an agent if they don't exist
 */
export async function initializeAgentStats(agentId: string): Promise<void> {
  try {
    await db
      .insert(agentStats)
      .values({
        agentId,
        totalHands: 0,
        wins: 0,
        totalWinnings: 0,
        biggestPot: 0,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error(`[AgentStatsDB] Error initializing stats for ${agentId}:`, error);
  }
}

/**
 * Reset all agent stats (for testing/admin purposes)
 */
export async function resetAllAgentStats(): Promise<void> {
  try {
    await db.delete(agentStats);
    console.log("[AgentStatsDB] Reset all agent stats");
  } catch (error) {
    console.error("[AgentStatsDB] Error resetting stats:", error);
  }
}

