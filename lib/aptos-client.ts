/**
 * Aptos Client Configuration
 * 
 * Centralized Aptos SDK configuration and utilities
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  AccountAddress,
  InputViewFunctionData,
} from "@aptos-labs/ts-sdk";

// Network configuration
const getNetwork = (): Network => {
  const network = process.env.APTOS_NETWORK?.toLowerCase();
  switch (network) {
    case "mainnet":
      return Network.MAINNET;
    case "devnet":
      return Network.DEVNET;
    case "testnet":
    default:
      return Network.TESTNET;
  }
};

// Initialize Aptos client
const config = new AptosConfig({ network: getNetwork() });
export const aptosClient = new Aptos(config);

// Contract address
export const GAME_CONTRACT_ADDRESS = process.env.GAME_CONTRACT_ADDRESS || "";

/**
 * Create account from hex private key
 */
export function accountFromPrivateKey(privateKeyHex: string): Account {
  // Remove 0x prefix if present
  const cleanKey = privateKeyHex.startsWith("0x") 
    ? privateKeyHex.slice(2) 
    : privateKeyHex;
  
  const privateKey = new Ed25519PrivateKey(cleanKey);
  return Account.fromPrivateKey({ privateKey });
}

/**
 * Generate a new random account
 */
export function generateAccount(): Account {
  return Account.generate();
}

/**
 * Get account APT balance in octas
 */
export async function getAccountBalance(address: string): Promise<bigint> {
  try {
    const balance = await aptosClient.getAccountAPTAmount({
      accountAddress: AccountAddress.from(address),
    });
    return BigInt(balance);
  } catch {
    return BigInt(0);
  }
}

/**
 * Format octas to APT
 */
export function octasToApt(octas: bigint | number): number {
  return Number(octas) / 100_000_000;
}

/**
 * Format APT to octas
 */
export function aptToOctas(apt: number): bigint {
  return BigInt(Math.floor(apt * 100_000_000));
}

/**
 * Call a view function on the poker contract
 */
export async function viewPokerContract<T>(
  functionName: string,
  args: (string | number | boolean)[] = []
): Promise<T> {
  const payload: InputViewFunctionData = {
    function: `${GAME_CONTRACT_ADDRESS}::poker::${functionName}`,
    functionArguments: args,
  };
  
  const result = await aptosClient.view({ payload });
  return result[0] as T;
}

/**
 * Submit a transaction to the poker contract
 */
export async function submitPokerTransaction(
  signer: Account,
  functionName: string,
  args: (string | number | boolean | Uint8Array)[]
): Promise<string> {
  const transaction = await aptosClient.transaction.build.simple({
    sender: signer.accountAddress,
    data: {
      function: `${GAME_CONTRACT_ADDRESS}::poker::${functionName}`,
      functionArguments: args,
    },
  });

  const pendingTx = await aptosClient.signAndSubmitTransaction({
    signer,
    transaction,
  });

  await aptosClient.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  return pendingTx.hash;
}

/**
 * Get game state from contract
 */
export async function getGameStage(
  registryOwner: string,
  gameId: string
): Promise<number> {
  return viewPokerContract<number>("get_game_stage", [registryOwner, gameId]);
}

/**
 * Get pot amount
 */
export async function getPot(
  registryOwner: string,
  gameId: string
): Promise<number> {
  return viewPokerContract<number>("get_pot", [registryOwner, gameId]);
}

/**
 * Get current bet amount
 */
export async function getCurrentBet(
  registryOwner: string,
  gameId: string
): Promise<number> {
  return viewPokerContract<number>("get_current_bet", [registryOwner, gameId]);
}

/**
 * Get current player index
 */
export async function getCurrentPlayerIndex(
  registryOwner: string,
  gameId: string
): Promise<number> {
  return viewPokerContract<number>("get_current_player_index", [registryOwner, gameId]);
}

/**
 * Get state nonce for verification
 */
export async function getStateNonce(
  registryOwner: string,
  gameId: string
): Promise<number> {
  return viewPokerContract<number>("get_state_nonce", [registryOwner, gameId]);
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerUrl(txHash: string): string {
  const network = getNetwork();
  const networkParam = network === Network.MAINNET ? "mainnet" : "testnet";
  return `https://explorer.aptoslabs.com/txn/${txHash}?network=${networkParam}`;
}

/**
 * Get explorer URL for account
 */
export function getAccountExplorerUrl(address: string): string {
  const network = getNetwork();
  const networkParam = network === Network.MAINNET ? "mainnet" : "testnet";
  return `https://explorer.aptoslabs.com/account/${address}?network=${networkParam}`;
}

