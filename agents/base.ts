/**
 * Base Poker Agent
 * 
 * Abstract base class for all poker agents
 */

import type { 
  GameState, 
  ThoughtRecord, 
  ActionType, 
  AgentModel,
  Player,
  Card 
} from "@/types";
import { AGENT_CONFIGS, AGENT_SYSTEM_PROMPTS, POKER_REASONING_PROMPT } from "@/types/agents";
import { createChatCompletionWithRetry, parseJsonResponse } from "@/lib/llm/client";
import { getValidActions } from "@/lib/poker/engine";
import { cardToString } from "@/lib/poker/deck";
import { hashString } from "@/lib/utils";

interface AgentDecision {
  thoughts: string;
  action: ActionType;
  amount: number;
  confidence: number;
}

export abstract class BasePokerAgent {
  readonly id: string;
  readonly name: string;
  readonly model: AgentModel;
  readonly personality: string;
  readonly avatar: string;
  readonly color: string;
  
  private privateKey?: string;
  
  constructor(model: AgentModel, privateKey?: string) {
    const config = AGENT_CONFIGS[model];
    this.id = config.id;
    this.name = config.name;
    this.model = model;
    this.personality = config.personality;
    this.avatar = config.avatar;
    this.color = config.color;
    this.privateKey = privateKey;
  }
  
  /**
   * Make a decision for the current game state
   */
  async decide(gameState: GameState): Promise<ThoughtRecord> {
    const player = this.getPlayer(gameState);
    if (!player) {
      throw new Error("Agent not in game");
    }
    
    const validActions = getValidActions(gameState, this.id);
    if (validActions.length === 0) {
      throw new Error("No valid actions available");
    }
    
    // Build the prompt
    const prompt = this.buildPrompt(gameState, player, validActions);
    
    // Get decision from LLM
    const decision = await this.queryLLM(prompt);
    
    // Validate and sanitize the decision
    const sanitizedDecision = this.sanitizeDecision(decision, validActions, player, gameState);
    
    // Create thought record
    const thoughtRecord: ThoughtRecord = {
      agentId: this.id,
      gameId: gameState.gameId,
      turn: gameState.stateNonce,
      stateHash: gameState.stateHash,
      thoughts: sanitizedDecision.thoughts,
      action: sanitizedDecision.action,
      amount: sanitizedDecision.amount,
      confidence: sanitizedDecision.confidence,
      timestamp: Date.now(),
      signature: this.signThought(sanitizedDecision),
    };
    
    return thoughtRecord;
  }
  
  /**
   * Build the prompt for the LLM
   */
  protected buildPrompt(
    gameState: GameState, 
    player: Player, 
    validActions: ActionType[]
  ): string {
    const holeCards = player.cards.map(cardToString).join(", ") || "Unknown";
    const communityCards = gameState.communityCards.map(cardToString).join(", ") || "None";
    const position = this.getPosition(gameState, player);
    const toCall = gameState.currentBet - player.bet;
    const playersRemaining = gameState.players.filter((p) => !p.folded).length;
    
    // Build recent actions string
    const recentActions = gameState.players
      .filter((p) => p.lastAction)
      .map((p) => `${p.name}: ${p.lastAction?.type} ${p.lastAction?.amount || ""}`)
      .join("\n") || "None yet";
    
    // Build opponent info
    const opponentInfo = gameState.players
      .filter((p) => p.id !== this.id && !p.folded)
      .map((p) => `${p.name}: Stack ${p.stack}, Bet ${p.bet}${p.isAllIn ? " (All-in)" : ""}`)
      .join("\n") || "None";
    
    return POKER_REASONING_PROMPT
      .replace("{holeCards}", holeCards)
      .replace("{communityCards}", communityCards)
      .replace("{stage}", gameState.stage)
      .replace("{pot}", String(gameState.pot))
      .replace("{toCall}", String(toCall))
      .replace("{stack}", String(player.stack))
      .replace("{position}", position)
      .replace("{playersRemaining}", String(playersRemaining))
      .replace("{recentActions}", recentActions)
      .replace("{opponentInfo}", opponentInfo)
      .replace("{availableActions}", validActions.join(", "));
  }
  
  /**
   * Query the LLM for a decision
   */
  protected async queryLLM(prompt: string): Promise<AgentDecision> {
    const systemPrompt = AGENT_SYSTEM_PROMPTS[this.model];
    
    const response = await createChatCompletionWithRetry({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: this.getTemperature(),
      maxTokens: 500,
      responseFormat: "json_object",
    });
    
    return parseJsonResponse<AgentDecision>(response.content);
  }
  
  /**
   * Get temperature based on agent personality
   */
  protected getTemperature(): number {
    switch (this.model) {
      case "gpt4":
        return 0.3; // Conservative
      case "claude":
        return 0.5; // Balanced
      case "gemini":
        return 0.7; // Aggressive
      case "deepseek":
        return 0.6; // Risk-taker
      case "grok":
        return 0.9; // Chaotic
      default:
        return 0.5;
    }
  }
  
  /**
   * Sanitize and validate the LLM decision
   */
  protected sanitizeDecision(
    decision: AgentDecision,
    validActions: ActionType[],
    player: Player,
    gameState: GameState
  ): AgentDecision {
    // Ensure action is valid
    let action = decision.action;
    if (!validActions.includes(action)) {
      // Default to safest valid action
      if (validActions.includes("check")) {
        action = "check";
      } else if (validActions.includes("fold")) {
        action = "fold";
      } else {
        action = validActions[0];
      }
    }
    
    // Sanitize amount
    let amount = decision.amount || 0;
    const toCall = gameState.currentBet - player.bet;
    
    if (action === "call") {
      amount = Math.min(toCall, player.stack);
    } else if (action === "bet" || action === "raise") {
      // Ensure minimum bet
      amount = Math.max(amount, gameState.bigBlind);
      // Ensure not more than stack
      amount = Math.min(amount, player.stack);
    } else if (action === "all_in") {
      amount = player.stack;
    } else {
      amount = 0;
    }
    
    // Sanitize confidence
    const confidence = Math.max(0, Math.min(1, decision.confidence || 0.5));
    
    // Ensure thoughts is a string
    const thoughts = typeof decision.thoughts === "string" 
      ? decision.thoughts.slice(0, 500) 
      : "Thinking...";
    
    return {
      thoughts,
      action,
      amount,
      confidence,
    };
  }
  
  /**
   * Get player's position description
   */
  protected getPosition(gameState: GameState, player: Player): string {
    const playerIndex = gameState.players.findIndex((p) => p.id === player.id);
    const dealerIndex = gameState.dealerIndex;
    const numPlayers = gameState.players.length;
    
    const relativePosition = (playerIndex - dealerIndex + numPlayers) % numPlayers;
    
    if (relativePosition === 0) return "Dealer (Button)";
    if (relativePosition === 1) return "Small Blind";
    if (relativePosition === 2) return "Big Blind";
    if (relativePosition === numPlayers - 1) return "Cutoff";
    return "Middle Position";
  }
  
  /**
   * Get this agent's player from the game state
   */
  protected getPlayer(gameState: GameState): Player | undefined {
    return gameState.players.find((p) => p.id === this.id);
  }
  
  /**
   * Sign a thought record
   */
  protected signThought(decision: AgentDecision): string {
    // In production, use proper cryptographic signing
    const message = JSON.stringify({
      action: decision.action,
      amount: decision.amount,
      thoughts: decision.thoughts,
      timestamp: Date.now(),
    });
    
    // Mock signature for now
    return `0x${hashString(message + (this.privateKey || this.id))}`;
  }
}

/**
 * Create an agent for a specific model
 */
export function createAgent(model: AgentModel, privateKey?: string): BasePokerAgent {
  // Dynamic import to avoid circular dependencies
  const AgentClass = class extends BasePokerAgent {
    constructor() {
      super(model, privateKey);
    }
  };
  
  return new AgentClass();
}

