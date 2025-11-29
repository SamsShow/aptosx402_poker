/**
 * Game Coordinator
 * 
 * Manages game state, action processing, and event broadcasting
 * Acts as the central authority for game logic
 */

import type { GameState, ThoughtRecord, TransactionRecord, ActionType } from "@/types";
import { processAction, startHand, prepareNextHand } from "@/lib/poker/engine";
import { generateRandomSeed } from "@/lib/poker/deck";
import { generateGameId } from "@/lib/utils";

interface GameSession {
  state: GameState;
  thoughts: ThoughtRecord[];
  transactions: TransactionRecord[];
  history: HandHistory[];
  listeners: Set<(event: GameEvent) => void>;
}

interface HandHistory {
  handNumber: number;
  startState: GameState;
  actions: {
    playerId: string;
    action: ActionType;
    amount: number;
    thought?: ThoughtRecord;
    timestamp: number;
  }[];
  endState: GameState;
  winners: string[];
}

interface GameEvent {
  type: string;
  gameId: string;
  payload: unknown;
  timestamp: number;
}

interface ActionResult {
  success: boolean;
  newState?: GameState;
  txHash?: string;
  error?: string;
}

class GameCoordinator {
  private games: Map<string, GameSession> = new Map();
  private globalListeners: Set<(event: GameEvent) => void> = new Set();
  
  /**
   * Register a new game
   */
  registerGame(state: GameState): void {
    this.games.set(state.gameId, {
      state,
      thoughts: [],
      transactions: [],
      history: [],
      listeners: new Set(),
    });
    
    this.broadcast({
      type: "game_created",
      gameId: state.gameId,
      payload: state,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Get game state
   */
  getGame(gameId: string): GameState | null {
    return this.games.get(gameId)?.state || null;
  }
  
  /**
   * Get all active games
   */
  getActiveGames(): GameState[] {
    return Array.from(this.games.values())
      .map((session) => session.state)
      .filter((state) => state.stage !== "settled");
  }
  
  /**
   * Get thoughts for a game
   */
  getThoughts(gameId: string): ThoughtRecord[] {
    return this.games.get(gameId)?.thoughts || [];
  }
  
  /**
   * Get transactions for a game
   */
  getTransactions(gameId: string): TransactionRecord[] {
    return this.games.get(gameId)?.transactions || [];
  }
  
  /**
   * Get hand history
   */
  getHistory(gameId: string, handNumber?: number): HandHistory[] | HandHistory | null {
    const session = this.games.get(gameId);
    if (!session) return null;
    
    if (handNumber !== undefined) {
      return session.history.find((h) => h.handNumber === handNumber) || null;
    }
    
    return session.history;
  }
  
  /**
   * Start a new hand
   */
  async startHand(gameId: string, seed?: string): Promise<ActionResult> {
    const session = this.games.get(gameId);
    if (!session) {
      return { success: false, error: "Game not found" };
    }
    
    try {
      // Generate seed if not provided
      const handSeed = seed || generateRandomSeed();
      
      // If current hand is settled, prepare for next hand
      if (session.state.stage === "settled" || session.state.stage === "waiting") {
        if (session.state.stage === "settled") {
          session.state = prepareNextHand(session.state);
        }
        
        // Start new hand
        const newState = startHand(session.state, handSeed);
        
        // Save start state for history
        const handHistory: HandHistory = {
          handNumber: newState.handNumber,
          startState: { ...newState },
          actions: [],
          endState: newState,
          winners: [],
        };
        session.history.push(handHistory);
        
        session.state = newState;
        
        this.broadcast({
          type: "game_started",
          gameId,
          payload: newState,
          timestamp: Date.now(),
        });
        
        return { success: true, newState };
      }
      
      return { success: false, error: "Game already in progress" };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to start hand" 
      };
    }
  }
  
  /**
   * Process a player action
   */
  async processAction(
    gameId: string,
    playerId: string,
    action: ActionType,
    amount: number,
    thought?: ThoughtRecord,
    _facilitatorReceipt?: string
  ): Promise<ActionResult> {
    const session = this.games.get(gameId);
    if (!session) {
      return { success: false, error: "Game not found" };
    }
    
    try {
      // Process the action
      const newState = processAction(session.state, playerId, action, amount);
      
      // Record thought
      if (thought) {
        session.thoughts.unshift(thought);
        
        this.broadcast({
          type: "thought_broadcast",
          gameId,
          payload: thought,
          timestamp: Date.now(),
        });
      }
      
      // Record transaction if there was a bet
      if (amount > 0 && action !== "fold") {
        const tx: TransactionRecord = {
          id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          gameId,
          from: playerId,
          to: "pot",
          amount,
          type: "bet",
          txHash: `0x${Date.now().toString(16)}`, // Mock hash
          timestamp: Date.now(),
          status: "confirmed",
        };
        session.transactions.unshift(tx);
        
        this.broadcast({
          type: "transaction_confirmed",
          gameId,
          payload: tx,
          timestamp: Date.now(),
        });
      }
      
      // Update history
      const currentHistory = session.history[session.history.length - 1];
      if (currentHistory) {
        currentHistory.actions.push({
          playerId,
          action,
          amount,
          thought,
          timestamp: Date.now(),
        });
        currentHistory.endState = newState;
      }
      
      // Update state
      session.state = newState;
      
      // Broadcast action
      this.broadcast({
        type: "action_taken",
        gameId,
        payload: {
          playerId,
          action,
          amount,
          newState,
        },
        timestamp: Date.now(),
      });
      
      // Check for stage change
      if (newState.stage !== session.state.stage) {
        this.broadcast({
          type: "stage_changed",
          gameId,
          payload: {
            stage: newState.stage,
            communityCards: newState.communityCards,
            pot: newState.pot,
          },
          timestamp: Date.now(),
        });
      }
      
      // Check for game end
      if (newState.stage === "settled" || newState.stage === "showdown") {
        const winners = newState.players
          .filter((p) => !p.folded)
          .map((p) => p.id);
        
        if (currentHistory) {
          currentHistory.winners = winners;
        }
        
        this.broadcast({
          type: "winner_declared",
          gameId,
          payload: {
            winners,
            pot: session.state.pot,
          },
          timestamp: Date.now(),
        });
      }
      
      return { success: true, newState };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to process action" 
      };
    }
  }
  
  /**
   * End a game
   */
  endGame(gameId: string): void {
    const session = this.games.get(gameId);
    if (session) {
      this.broadcast({
        type: "game_ended",
        gameId,
        payload: { finalState: session.state },
        timestamp: Date.now(),
      });
      
      this.games.delete(gameId);
    }
  }
  
  /**
   * Subscribe to game events
   */
  subscribe(gameId: string, listener: (event: GameEvent) => void): () => void {
    const session = this.games.get(gameId);
    if (session) {
      session.listeners.add(listener);
      return () => session.listeners.delete(listener);
    }
    return () => {};
  }
  
  /**
   * Subscribe to all events
   */
  subscribeAll(listener: (event: GameEvent) => void): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }
  
  /**
   * Broadcast an event
   */
  private broadcast(event: GameEvent): void {
    // Notify game-specific listeners
    const session = this.games.get(event.gameId);
    if (session) {
      session.listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error("[Coordinator] Listener error:", error);
        }
      });
    }
    
    // Notify global listeners
    this.globalListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[Coordinator] Global listener error:", error);
      }
    });
  }
}

// Singleton instance
export const gameCoordinator = new GameCoordinator();

