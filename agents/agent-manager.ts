/**
 * Agent Manager
 * 
 * Manages all poker agents and coordinates their actions
 * Stats are persisted to database for durability
 */

import type { GameState, ThoughtRecord, AgentModel } from "@/types";
import { BasePokerAgent, createAgent } from "./base";
import { AGENT_CONFIGS } from "@/types/agents";
import { 
  getAllAgentStatsFromDB, 
  recordAgentHandResult, 
  initializeAgentStats,
  type AgentStatsData 
} from "@/lib/db/agent-stats-db";

interface AgentInstance {
  agent: BasePokerAgent;
  isActive: boolean;
  lastThought?: ThoughtRecord;
  // Stats are now loaded from database, cached here for quick access
  cachedStats?: AgentStatsData;
}

class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  private statsCache: Record<string, AgentStatsData> = {};
  private statsLoaded = false;
  
  /**
   * Initialize all agents
   */
  initialize(): void {
    const models: AgentModel[] = ["claude", "gpt4", "gemini", "deepseek", "grok"];
    
    for (const model of models) {
      const agent = createAgent(model);
      this.agents.set(agent.id, {
        agent,
        isActive: true,
      });
      
      console.log(`[AgentManager] Initialized agent: ${agent.name} (${agent.model})`);
    }
    
    // Load stats from database asynchronously
    this.loadStatsFromDB();
  }
  
  /**
   * Load stats from database
   */
  private async loadStatsFromDB(): Promise<void> {
    try {
      // Initialize stats for all agents in database
      for (const agentId of Array.from(this.agents.keys())) {
        await initializeAgentStats(agentId);
      }
      
      // Load all stats
      this.statsCache = await getAllAgentStatsFromDB();
      this.statsLoaded = true;
      console.log("[AgentManager] Loaded stats from database");
    } catch (error) {
      console.error("[AgentManager] Error loading stats from DB:", error);
    }
  }
  
  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): BasePokerAgent | null {
    return this.agents.get(agentId)?.agent || null;
  }
  
  /**
   * Get all active agents
   */
  getActiveAgents(): BasePokerAgent[] {
    return Array.from(this.agents.values())
      .filter((instance) => instance.isActive)
      .map((instance) => instance.agent);
  }
  
  /**
   * Get agent configurations for game creation
   */
  getAgentConfigs() {
    return Object.values(AGENT_CONFIGS);
  }
  
  /**
   * Request a decision from an agent
   */
  async requestDecision(
    agentId: string,
    gameState: GameState
  ): Promise<ThoughtRecord> {
    const instance = this.agents.get(agentId);
    if (!instance) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    if (!instance.isActive) {
      throw new Error(`Agent is not active: ${agentId}`);
    }
    
    console.log(`[AgentManager] Requesting decision from ${instance.agent.name}`);
    
    const thought = await instance.agent.decide(gameState);
    instance.lastThought = thought;
    
    console.log(`[AgentManager] ${instance.agent.name} decided: ${thought.action} ${thought.amount}`);
    
    return thought;
  }
  
  /**
   * Record a hand result for an agent (persists to database)
   */
  async recordResult(agentId: string, won: boolean, potWon: number = 0): Promise<void> {
    const instance = this.agents.get(agentId);
    if (!instance) return;
    
    try {
      // Persist to database
      await recordAgentHandResult(agentId, won, potWon);
      
      // Update cache
      const currentStats = this.statsCache[agentId] || {
        agentId,
        totalHands: 0,
        wins: 0,
        winRate: 0,
        totalWinnings: 0,
        biggestPot: 0,
      };
      
      this.statsCache[agentId] = {
        ...currentStats,
        totalHands: currentStats.totalHands + 1,
        wins: currentStats.wins + (won ? 1 : 0),
        winRate: (currentStats.wins + (won ? 1 : 0)) / (currentStats.totalHands + 1),
        totalWinnings: currentStats.totalWinnings + potWon,
        biggestPot: Math.max(currentStats.biggestPot, potWon),
      };
      
      console.log(`[AgentManager] Recorded result for ${agentId}: won=${won}, pot=${potWon}`);
    } catch (error) {
      console.error(`[AgentManager] Error recording result for ${agentId}:`, error);
    }
  }
  
  /**
   * Get agent statistics (from database cache)
   */
  getStats(agentId: string): { totalHands: number; wins: number; winRate: number } | null {
    const instance = this.agents.get(agentId);
    if (!instance) return null;
    
    const stats = this.statsCache[agentId];
    if (!stats) {
      return { totalHands: 0, wins: 0, winRate: 0 };
    }
    
    return {
      totalHands: stats.totalHands,
      wins: stats.wins,
      winRate: stats.winRate,
    };
  }
  
  /**
   * Get all agent statistics (from database cache)
   */
  getAllStats(): Record<string, { totalHands: number; wins: number; winRate: number }> {
    const stats: Record<string, { totalHands: number; wins: number; winRate: number }> = {};
    
    for (const [agentId] of Array.from(this.agents.entries())) {
      const cachedStats = this.statsCache[agentId];
      stats[agentId] = cachedStats 
        ? { totalHands: cachedStats.totalHands, wins: cachedStats.wins, winRate: cachedStats.winRate }
        : { totalHands: 0, wins: 0, winRate: 0 };
    }
    
    return stats;
  }
  
  /**
   * Refresh stats from database
   */
  async refreshStats(): Promise<void> {
    try {
      this.statsCache = await getAllAgentStatsFromDB();
      console.log("[AgentManager] Refreshed stats from database");
    } catch (error) {
      console.error("[AgentManager] Error refreshing stats:", error);
    }
  }
  
  /**
   * Activate or deactivate an agent
   */
  setActive(agentId: string, active: boolean): void {
    const instance = this.agents.get(agentId);
    if (instance) {
      instance.isActive = active;
    }
  }
  
  /**
   * Reset agent statistics (clears database and cache)
   */
  async resetStats(): Promise<void> {
    try {
      const { resetAllAgentStats } = await import("@/lib/db/agent-stats-db");
      await resetAllAgentStats();
      this.statsCache = {};
      console.log("[AgentManager] Reset all stats");
    } catch (error) {
      console.error("[AgentManager] Error resetting stats:", error);
    }
  }
}

// Singleton instance
// Use global to persist across Next.js hot reloads and API routes
declare global {
  // eslint-disable-next-line no-var
  var agentManagerInstance: AgentManager | undefined;
}

// Singleton instance - use globalThis to persist across API routes
if (!globalThis.agentManagerInstance) {
  globalThis.agentManagerInstance = new AgentManager();
}

export const agentManager = globalThis.agentManagerInstance;

// Initialize on module load
if (typeof window === "undefined") {
  // Server-side only
  agentManager.initialize();
}

