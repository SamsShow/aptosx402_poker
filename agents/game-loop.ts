/**
 * Game Loop
 * 
 * Runs the autonomous poker game with agent turns
 */

import type { GameState, ThoughtRecord } from "@/types";
import { gameCoordinator } from "@/lib/game-coordinator";
import { agentManager } from "./agent-manager";
import { sleep } from "@/lib/utils";

interface GameLoopOptions {
  gameId: string;
  turnDelay?: number; // ms between turns
  handDelay?: number; // ms between hands
  maxHands?: number;
  onThought?: (thought: ThoughtRecord) => void;
  onStateChange?: (state: GameState) => void;
  onError?: (error: Error) => void;
}

class GameLoop {
  private isRunning = false;
  private shouldStop = false;
  private currentGameId: string | null = null;
  
  /**
   * Start the game loop
   */
  async start(options: GameLoopOptions): Promise<void> {
    if (this.isRunning) {
      throw new Error("Game loop already running");
    }
    
    const {
      gameId,
      turnDelay = 2000,
      handDelay = 5000,
      maxHands = 100,
      onThought,
      onStateChange,
      onError,
    } = options;
    
    this.isRunning = true;
    this.shouldStop = false;
    this.currentGameId = gameId;
    
    console.log(`[GameLoop] Starting game loop for ${gameId}`);
    
    try {
      let handCount = 0;
      
      while (!this.shouldStop && handCount < maxHands) {
        // Get current game state
        let gameState = gameCoordinator.getGame(gameId);
        if (!gameState) {
          console.error("[GameLoop] Game not found");
          break;
        }
        
        // If game is in waiting or settled state, start a new hand
        if (gameState.stage === "waiting" || gameState.stage === "settled") {
          console.log(`[GameLoop] Game in ${gameState.stage} state, starting hand...`);
          const startResult = await gameCoordinator.startHand(gameId);
          if (!startResult.success) {
            console.error("[GameLoop] Failed to start hand:", startResult.error);
            // Wait a bit and retry
            await sleep(1000);
            continue;
          }
          gameState = startResult.newState!;
          handCount = gameState.handNumber || 1;
          console.log(`[GameLoop] Started hand ${handCount}, stage: ${gameState.stage}`);
        } else {
          // Game is already in progress, continue playing
          console.log(`[GameLoop] Continuing hand ${gameState.handNumber} at stage: ${gameState.stage}`);
          handCount = gameState.handNumber || 1;
        }
        
        onStateChange?.(gameState);
        
        // Play the hand
        while (!this.shouldStop && gameState.stage !== "settled" && gameState.stage !== "showdown") {
          // Refresh game state
          gameState = gameCoordinator.getGame(gameId)!;
          if (!gameState) break;
          
          // Check if we're at showdown
          if (gameState.stage === "showdown" || gameState.stage === "settled") {
            break;
          }
          
          // Get current player
          const currentPlayer = gameState.players[gameState.currentPlayerIndex];
          
          if (!currentPlayer) {
            console.error(`[GameLoop] No player at index ${gameState.currentPlayerIndex}`);
            await sleep(100);
            continue;
          }
          
          if (currentPlayer.folded || currentPlayer.isAllIn) {
            // Skip this player, advance turn
            console.log(`[GameLoop] Skipping ${currentPlayer.name} (folded: ${currentPlayer.folded}, allIn: ${currentPlayer.isAllIn})`);
            await sleep(100);
            continue;
          }
          
          console.log(`[GameLoop] ${currentPlayer.name}'s turn (stage: ${gameState.stage}, pot: ${gameState.pot}, currentBet: ${gameState.currentBet})`);
          
          try {
            // Get agent decision
            const thought = await agentManager.requestDecision(
              currentPlayer.id,
              gameState
            );
            
            if (!thought) {
              console.error(`[GameLoop] No thought returned for ${currentPlayer.name}`);
              // Default to fold if no thought
              await gameCoordinator.processAction(
                gameId,
                currentPlayer.id,
                "fold",
                0
              );
              gameState = gameCoordinator.getGame(gameId)!;
              continue;
            }
            
            console.log(`[GameLoop] ${currentPlayer.name} decided: ${thought.action} ${thought.amount > 0 ? `$${thought.amount}` : ''}`);
            
            onThought?.(thought);
            
            // Add delay for spectator experience
            await sleep(turnDelay);
            
            // Process the action
            const actionResult = await gameCoordinator.processAction(
              gameId,
              currentPlayer.id,
              thought.action,
              thought.amount,
              thought
            );
            
            if (actionResult.success && actionResult.newState) {
              gameState = actionResult.newState;
              onStateChange?.(gameState);
              console.log(`[GameLoop] Action processed successfully, new stage: ${gameState.stage}`);
            } else {
              console.error("[GameLoop] Action failed:", actionResult.error);
              // If action fails, try to continue with next player
            }
          } catch (error) {
            console.error("[GameLoop] Error getting agent decision:", error);
            onError?.(error instanceof Error ? error : new Error(String(error)));
            
            // Default to fold on error
            try {
              await gameCoordinator.processAction(
                gameId,
                currentPlayer.id,
                "fold",
                0
              );
            } catch (foldError) {
              console.error("[GameLoop] Failed to fold on error:", foldError);
            }
          }
          
          // Update state
          gameState = gameCoordinator.getGame(gameId)!;
          if (!gameState) {
            console.error("[GameLoop] Game state lost after action");
            break;
          }
        }
        
        // Final state update
        gameState = gameCoordinator.getGame(gameId)!;
        
        // Record results
        if (gameState) {
          const winners = gameState.players.filter((p) => !p.folded);
          const potPerWinner = winners.length > 0 ? Math.floor(gameState.pot / winners.length) : 0;
          
          // Record results for all players (await the async calls)
          await Promise.all(
            gameState.players.map((player) => {
              const won = winners.some((w) => w.id === player.id);
              const potWon = won ? potPerWinner : 0;
              return agentManager.recordResult(player.id, won, potWon);
            })
          );
          
          console.log(`[GameLoop] Hand ${handCount} complete. Winners: ${winners.map(w => w.name).join(", ")}, Pot: ${gameState.pot}`);
        }
        
        // Delay between hands
        if (!this.shouldStop && handCount < maxHands) {
          await sleep(handDelay);
        }
      }
      
      console.log(`[GameLoop] Game loop ended after ${handCount} hands`);
    } catch (error) {
      console.error("[GameLoop] Fatal error:", error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isRunning = false;
      this.currentGameId = null;
    }
  }
  
  /**
   * Stop the game loop
   */
  stop(): void {
    console.log("[GameLoop] Stopping game loop");
    this.shouldStop = true;
  }
  
  /**
   * Check if the game loop is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
  
  /**
   * Get current game ID
   */
  getCurrentGameId(): string | null {
    return this.currentGameId;
  }
}

// Use global to persist across Next.js hot reloads and API routes
declare global {
  // eslint-disable-next-line no-var
  var gameLoopInstance: GameLoop | undefined;
}

// Singleton instance - use globalThis to persist across API routes
if (!globalThis.gameLoopInstance) {
  globalThis.gameLoopInstance = new GameLoop();
}

export const gameLoop = globalThis.gameLoopInstance;
