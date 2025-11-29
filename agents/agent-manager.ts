/**
 * Agent Manager
 * 
 * Manages all poker agents and coordinates their actions
 */

import type { GameState, ThoughtRecord, AgentModel } from "@/types";
import { BasePokerAgent, createAgent } from "./base";
import { AGENT_CONFIGS } from "@/types/agents";

interface AgentInstance {
  agent: BasePokerAgent;
  isActive: boolean;
  lastThought?: ThoughtRecord;
  totalHands: number;
  wins: number;
}

class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  
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
        totalHands: 0,
        wins: 0,
      });
      
      console.log(`[AgentManager] Initialized agent: ${agent.name} (${agent.model})`);
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
   * Record a hand result for an agent
   */
  recordResult(agentId: string, won: boolean): void {
    const instance = this.agents.get(agentId);
    if (instance) {
      instance.totalHands++;
      if (won) {
        instance.wins++;
      }
    }
  }
  
  /**
   * Get agent statistics
   */
  getStats(agentId: string): { totalHands: number; wins: number; winRate: number } | null {
    const instance = this.agents.get(agentId);
    if (!instance) return null;
    
    return {
      totalHands: instance.totalHands,
      wins: instance.wins,
      winRate: instance.totalHands > 0 ? instance.wins / instance.totalHands : 0,
    };
  }
  
  /**
   * Get all agent statistics
   */
  getAllStats(): Record<string, { totalHands: number; wins: number; winRate: number }> {
    const stats: Record<string, { totalHands: number; wins: number; winRate: number }> = {};
    
    for (const [agentId, instance] of Array.from(this.agents.entries())) {
      stats[agentId] = {
        totalHands: instance.totalHands,
        wins: instance.wins,
        winRate: instance.totalHands > 0 ? instance.wins / instance.totalHands : 0,
      };
    }
    
    return stats;
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
   * Reset agent statistics
   */
  resetStats(): void {
    for (const instance of Array.from(this.agents.values())) {
      instance.totalHands = 0;
      instance.wins = 0;
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

