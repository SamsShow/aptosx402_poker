#!/usr/bin/env node
/**
 * Check Settlement Details
 * 
 * This script checks a specific game's hand history to see why
 * settlement transactions aren't being created.
 */

const API_BASE = process.env.API_URL || "http://localhost:3000";

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
  const gameId = process.argv[2];
  
  if (!gameId) {
    console.log("Usage: node scripts/check-settlement.js <gameId>");
    console.log("\nFinding a game to check...");
    
    const gamesRes = await api("/api/game");
    if (gamesRes.success && gamesRes.games && gamesRes.games.length > 0) {
      const game = gamesRes.games[0];
      console.log(`Using game: ${game.gameId}`);
      return mainWithGameId(game.gameId);
    } else {
      console.error("No games found");
      process.exit(1);
    }
  }
  
  return mainWithGameId(gameId);
}

async function mainWithGameId(gameId) {
  console.log("=".repeat(60));
  console.log(`Checking Settlement for Game: ${gameId}`);
  console.log("=".repeat(60));

  // Get game state
  const gameRes = await api(`/api/game/${gameId}`);
  if (!gameRes.success) {
    console.error("Failed to get game:", gameRes.error);
    process.exit(1);
  }

  const gameState = gameRes.gameState;
  console.log(`\nGame Stage: ${gameState.stage}`);
  console.log(`Pot: ${gameState.pot} chips`);
  console.log(`Hand Number: ${gameState.handNumber || 0}`);

  // Get hand history
  const historyRes = await api(`/api/game/${gameId}/history`);
  if (historyRes.success && historyRes.history && historyRes.history.length > 0) {
    const latestHand = historyRes.history[0];
    console.log(`\nLatest Hand #${latestHand.handNumber}:`);
    console.log(`  Winners: ${latestHand.winners?.join(", ") || "None"}`);
    console.log(`  Actions: ${latestHand.actions?.length || 0}`);
    
    if (latestHand.actions && latestHand.actions.length > 0) {
      console.log("\n  Action Details:");
      for (const action of latestHand.actions) {
        console.log(`    - ${action.playerId}: ${action.type} ${action.amount > 0 ? `$${action.amount}` : ""}`);
      }
      
      // Calculate losers
      const winners = latestHand.winners || [];
      const losers = latestHand.actions
        .filter(a => a.amount > 0 && !winners.includes(a.playerId))
        .map(a => ({ playerId: a.playerId, amount: a.amount }));
      
      console.log(`\n  Losers (bet but didn't win): ${losers.length}`);
      for (const loser of losers) {
        console.log(`    - ${loser.playerId}: ${loser.amount} chips`);
      }
      
      if (losers.length === 0) {
        console.log("\n  ⚠️  No losers found! This means:");
        console.log("     - Either everyone folded except the winner");
        console.log("     - Or winner determination is incorrect");
        console.log(`     - Winners determined: ${winners.join(", ")}`);
      }
    }
  } else {
    console.log("\nNo hand history found");
  }

  // Get transactions
  console.log("\n" + "=".repeat(60));
  console.log("Transactions:");
  console.log("=".repeat(60));
  
  const transactions = gameRes.transactions || [];
  const pendingBets = transactions.filter(tx => tx.type === "bet" && tx.status === "pending");
  const settlements = transactions.filter(tx => tx.type === "settlement" && tx.status === "confirmed");
  const sponsorTxs = transactions.filter(tx => tx.type === "sponsor");
  
  console.log(`\nPending Bets: ${pendingBets.length}`);
  console.log(`Settlement TXs: ${settlements.length}`);
  console.log(`Sponsor TXs: ${sponsorTxs.length} (filtered out)`);
  
  if (settlements.length > 0) {
    console.log("\nSettlement Transactions:");
    for (const tx of settlements) {
      const aptAmount = (tx.amountOctas || tx.amount) / 100_000_000;
      console.log(`  ${tx.from} -> ${tx.to}: ${aptAmount.toFixed(4)} APT`);
      console.log(`    Hash: ${tx.txHash}`);
      console.log(`    Explorer: https://explorer.aptoslabs.com/txn/${tx.txHash}?network=testnet`);
    }
  } else {
    console.log("\n⚠️  No settlement transactions found!");
    console.log("   This could mean:");
    console.log("   1. No losers (everyone folded except winner)");
    console.log("   2. Settlement function not being called");
    console.log("   3. Wallets not initialized");
    console.log("   4. Transfer failures");
  }

  // Check player states
  console.log("\n" + "=".repeat(60));
  console.log("Player States:");
  console.log("=".repeat(60));
  
  for (const player of gameState.players) {
    console.log(`\n${player.name} (${player.id}):`);
    console.log(`  Stack: ${player.stack} chips`);
    console.log(`  Folded: ${player.folded}`);
    console.log(`  Address: ${player.address}`);
  }
}

main().catch(console.error);

