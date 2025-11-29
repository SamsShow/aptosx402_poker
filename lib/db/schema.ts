/**
 * Database Schema - Neon PostgreSQL
 * 
 * Schema for game history, agent wallets, and replay
 */

import { pgTable, text, integer, real, timestamp, bigint, jsonb } from "drizzle-orm/pg-core";

// Games table
export const games = pgTable("games", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  stage: text("stage").notNull(),
  buyIn: integer("buy_in").notNull(),
  smallBlind: integer("small_blind").notNull(),
  bigBlind: integer("big_blind").notNull(),
  handNumber: integer("hand_number").notNull().default(0),
  totalHands: integer("total_hands").notNull().default(0),
  winnerId: text("winner_id"),
});

// Agent wallets table - stores private keys
export const agentWallets = pgTable("agent_wallets", {
  agentId: text("agent_id").primaryKey(),
  name: text("name").notNull(),
  model: text("model").notNull(),
  address: text("address").notNull(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Hands table (individual poker hands within a game)
export const hands = pgTable("hands", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.id),
  handNumber: integer("hand_number").notNull(),
  startState: jsonb("start_state").notNull(),
  endState: jsonb("end_state").notNull(),
  winnerId: text("winner_id"),
  potSize: integer("pot_size").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Actions table
export const actions = pgTable("actions", {
  id: text("id").primaryKey(),
  handId: text("hand_id").notNull().references(() => hands.id),
  playerId: text("player_id").notNull(),
  actionType: text("action_type").notNull(),
  amount: integer("amount").notNull().default(0),
  stateHash: text("state_hash"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  sequenceNumber: integer("sequence_number").notNull(),
});

// Thoughts table
export const thoughts = pgTable("thoughts", {
  id: text("id").primaryKey(),
  actionId: text("action_id").references(() => actions.id),
  agentId: text("agent_id").notNull(),
  gameId: text("game_id").notNull(),
  turn: integer("turn").notNull(),
  stateHash: text("state_hash").notNull(),
  thoughts: text("thoughts").notNull(),
  action: text("action").notNull(),
  amount: integer("amount").notNull(),
  confidence: real("confidence").notNull(),
  signature: text("signature").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  gameId: text("game_id").references(() => games.id),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  type: text("type").notNull(), // buy_in, bet, pot_win, refund
  txHash: text("tx_hash"),
  facilitatorReceipt: text("facilitator_receipt"),
  status: text("status").notNull().default("pending"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Agent stats table
export const agentStats = pgTable("agent_stats", {
  agentId: text("agent_id").primaryKey(),
  totalHands: integer("total_hands").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  totalWinnings: bigint("total_winnings", { mode: "number" }).notNull().default(0),
  biggestPot: bigint("biggest_pot", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Type exports
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type AgentWallet = typeof agentWallets.$inferSelect;
export type NewAgentWallet = typeof agentWallets.$inferInsert;
export type Hand = typeof hands.$inferSelect;
export type NewHand = typeof hands.$inferInsert;
export type Action = typeof actions.$inferSelect;
export type NewAction = typeof actions.$inferInsert;
export type Thought = typeof thoughts.$inferSelect;
export type NewThought = typeof thoughts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type AgentStat = typeof agentStats.$inferSelect;
export type NewAgentStat = typeof agentStats.$inferInsert;
