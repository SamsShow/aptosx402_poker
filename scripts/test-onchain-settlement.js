#!/usr/bin/env node
/**
 * Test On-Chain Settlement
 * 
 * This script tests the full poker flow including on-chain APT transfers
 * when hands settle between agents.
 */

const API_BASE = process.env.API_URL || "http://localhost:3000";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res.json();
}

async function main() {
  console.log("=".repeat(60));
  console.log("Testing On-Chain Settlement");
  console.log("=".repeat(60));

  // 1. Try to find an existing game with chips
  console.log("\n1. Looking for existing games...");
  let gameId = null;
  let gameRes = null;

  const gamesRes = await api("/api/game");
  if (gamesRes.success && gamesRes.games && gamesRes.games.length > 0) {
    // Find a game with players that have chips
    for (const game of gamesRes.games) {
      if (game.players && game.players.length >= 2) {
        const hasChips = game.players.some(p => p.stack > 0);
        if (hasChips) {
          gameId = game.gameId;
          console.log(`   Found existing game: ${gameId}`);
          console.log(`   Players: ${game.players.map(p => `${p.name} (${p.stack} chips)`).join(", ")}`);
          break;
        }
      }
    }
  }

  // 2. If no suitable game found, create a new one
  if (!gameId) {
    console.log("\n2. No suitable game found, creating a new game...");
    const createRes = await api("/api/game", {
      method: "POST",
      body: JSON.stringify({
        players: ["claude", "grok"],
        buyIn: 100, // 100 chips = 0.1 APT
        smallBlind: 5,
        bigBlind: 10,
      }),
    });

    if (!createRes.success) {
      console.error("Failed to create game:", createRes.error);
      process.exit(1);
    }

    gameId = createRes.gameState.gameId;
    console.log(`   Game created: ${gameId}`);
  } else {
    console.log("\n2. Using existing game");
  }

  // 3. Get game state and check wallets
  console.log("\n3. Getting game state and wallet info...");
  gameRes = await api(`/api/game/${gameId}`);
  
  if (!gameRes.success) {
    console.error("Failed to get game:", gameRes.error);
    process.exit(1);
  }

  console.log(`   Players:`);
  for (const player of gameRes.gameState.players) {
    console.log(`   - ${player.name}: ${player.address.slice(0, 10)}... (stack: ${player.stack} chips)`);
  }

  // Check if players have chips
  const playersWithChips = gameRes.gameState.players.filter(p => p.stack > 0);
  if (playersWithChips.length < 2) {
    console.log("\n   ⚠️  Players don't have chips yet. Need to start a hand first.");
    console.log("   Starting a hand to give players chips...");
    
    // Start a hand to give players chips
    const startRes = await api(`/api/game/${gameId}/start`, {
      method: "POST",
      body: JSON.stringify({
        skipFundingCheck: false,
      }),
    });

    if (!startRes.success) {
      console.error("Failed to start hand:", startRes.error);
      console.log("   Trying to sync balances and fund agents...");
      
      // Sync balances first
      await api(`/api/game/${gameId}/sync-balances`, { method: "POST" });
      await sleep(2000);
      
      // Try starting again
      const retryStart = await api(`/api/game/${gameId}/start`, {
        method: "POST",
        body: JSON.stringify({
          skipFundingCheck: false,
        }),
      });
      
      if (!retryStart.success) {
        console.error("Still failed to start hand:", retryStart.error);
        process.exit(1);
      }
    }
    
    // Wait a moment and refresh game state
    await sleep(2000);
    gameRes = await api(`/api/game/${gameId}`);
    
    console.log("   Updated player stacks:");
    for (const player of gameRes.gameState.players) {
      console.log(`   - ${player.name}: ${player.stack} chips`);
    }
  }

  // 4. Check wallet funding status
  console.log("\n4. Checking wallet balances...");
  const balanceRes = await api(`/api/game-wallets/status?gameId=${gameId}`);
  
  if (balanceRes.success) {
    console.log(`   Funding status: ${balanceRes.summary?.allFunded ? "All funded ✓" : "Needs funding"}`);
    for (const player of balanceRes.players || []) {
      console.log(`   - ${player.agentId}: ${(player.balance / 100_000_000).toFixed(4)} APT (${player.hasSufficientBalance ? "OK" : "NEEDS FUNDING"})`);
    }
  }

  // 5. Fund agents if needed
  if (balanceRes.summary && !balanceRes.summary.allFunded) {
    console.log("\n5. Funding agents from faucet...");
    
    for (const player of balanceRes.players || []) {
      if (!player.hasSufficientBalance) {
        console.log(`   Funding ${player.agentId}...`);
        const fundRes = await api(`/api/agents/${player.agentId}/fund`, {
          method: "POST",
          body: JSON.stringify({
            amount: 100_000_000, // 1 APT
            source: "faucet",
          }),
        });
        
        if (fundRes.success) {
          console.log(`   ✓ Funded ${player.agentId}: ${fundRes.newBalance} octas`);
        } else {
          console.log(`   ✗ Failed to fund ${player.agentId}: ${fundRes.error}`);
        }
        
        await sleep(2000); // Wait between faucet requests
      }
    }
    
    // Re-sync balances
    console.log("\n   Syncing balances...");
    await api(`/api/game/${gameId}/sync-balances`, { method: "POST" });
    await sleep(2000);
  }

  // 6. Start the game loop (just 1 hand for testing)
  console.log("\n6. Starting game loop (1 hand)...");
  const runRes = await api(`/api/game/${gameId}/run`, {
    method: "POST",
    body: JSON.stringify({
      turnDelay: 1500,  // 1.5 seconds between turns
      handDelay: 2000,   // 2 seconds between hands
      maxHands: 1,       // Just 1 hand for testing
    }),
  });

  if (!runRes.success) {
    console.error("Failed to start game:", runRes.error);
    process.exit(1);
  }

  console.log("   Game loop started!");

  // 7. Poll for game completion
  console.log("\n7. Waiting for hand to complete...");
  let settled = false;
  let iterations = 0;
  const maxIterations = 60; // 60 * 2s = 2 minutes max

  while (!settled && iterations < maxIterations) {
    await sleep(2000);
    iterations++;

    const stateRes = await api(`/api/game/${gameId}`);
    if (!stateRes.success) continue;

    const stage = stateRes.gameState.stage;
    const pot = stateRes.gameState.pot;
    const txCount = (stateRes.transactions || []).filter(
      tx => tx.status === "confirmed" && tx.txHash && tx.txHash !== "pending_settlement"
    ).length;

    process.stdout.write(`\r   Stage: ${stage.padEnd(10)} | Pot: ${pot.toString().padStart(4)} | On-chain TXs: ${txCount}`);

    if (stage === "settled" || stage === "showdown") {
      settled = true;
      console.log("\n");
    }
  }

  if (!settled) {
    console.log("\n   ✗ Timeout waiting for hand to settle");
    process.exit(1);
  }

  // 8. Check for on-chain transactions
  console.log("\n8. Checking on-chain settlement transactions...");
  const finalRes = await api(`/api/game/${gameId}`);

  if (!finalRes.success) {
    console.error("Failed to get final game state");
    process.exit(1);
  }

  const onChainTxs = (finalRes.transactions || []).filter(
    tx => tx.status === "confirmed" && tx.txHash && tx.txHash !== "pending_settlement" && tx.type !== "sponsor"
  );

  if (onChainTxs.length === 0) {
    console.log("   ✗ No on-chain settlement transactions found!");
    console.log("\n   All transactions:");
    for (const tx of finalRes.transactions || []) {
      console.log(`   - ${tx.type}: ${tx.from} -> ${tx.to} (${tx.amount}) [${tx.status}] ${tx.txHash?.slice(0, 20) || "no hash"}...`);
    }
  } else {
    console.log(`   ✓ Found ${onChainTxs.length} on-chain transaction(s)!\n`);
    
    for (const tx of onChainTxs) {
      const aptAmount = (tx.amountOctas || tx.amount) / 100_000_000;
      console.log(`   TX: ${tx.from} -> ${tx.to}`);
      console.log(`       Amount: ${aptAmount.toFixed(4)} APT`);
      console.log(`       Type: ${tx.type}`);
      console.log(`       Hash: ${tx.txHash}`);
      console.log(`       Explorer: https://explorer.aptoslabs.com/txn/${tx.txHash}?network=testnet`);
      console.log();
    }
  }

  // 9. Show final player stacks
  console.log("\n9. Final player stacks:");
  for (const player of finalRes.gameState.players) {
    console.log(`   - ${player.name}: ${player.stack} chips`);
  }

  // 10. Stop the game loop
  console.log("\n10. Stopping game loop...");
  await api(`/api/game/${gameId}/run`, { method: "DELETE" });

  console.log("\n" + "=".repeat(60));
  console.log("Test complete!");
  console.log("=".repeat(60));
}

main().catch(console.error);

