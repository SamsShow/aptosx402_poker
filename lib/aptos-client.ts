/**
 * Aptos Client Configuration
 * 
 * Centralized Aptos SDK configuration and utilities
 * Supports Geomi API for enhanced access and faucet functionality
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  AccountAddress,
  InputViewFunctionData,
  ClientConfig,
} from "@aptos-labs/ts-sdk";

// API Configuration (Geomi or other provider)
// Read at runtime to ensure env vars are loaded
// Supports both GEOMI_* and APTOS_* prefixes for flexibility
const getGeomiApiKey = (): string | undefined => {
  // Try GEOMI_API_KEY first, then fall back to APTOS_API_KEY
  const key = process.env.GEOMI_API_KEY || process.env.APTOS_API_KEY;
  if (key) {
    return key;
  }
  return undefined;
};

const getGeomiNodeUrl = (): string | undefined => {
  return process.env.GEOMI_NODE_URL || process.env.APTOS_NODE_URL;
};

const getGeomiFaucetUrl = (): string | undefined => {
  return process.env.GEOMI_FAUCET_URL || process.env.APTOS_FAUCET_URL;
};

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

// Build client config with API key if available
const buildClientConfig = (): ClientConfig | undefined => {
  const apiKey = getGeomiApiKey();
  if (apiKey) {
    return {
      API_KEY: apiKey,
      HEADERS: {
        Authorization: `Bearer ${apiKey}`,
      },
    };
  }
  return undefined;
};

// Build Aptos config with optional custom URLs and API key
// Safe for both server and client side
const buildAptosConfig = (): AptosConfig => {
  const network = getNetwork();

  const isServer = typeof window === "undefined";

  // Use API key only on server-side (for enhanced rate limits)
  const clientConfig = isServer ? buildClientConfig() : undefined;

  // Use Geomi node URL on both client and server (better infrastructure)
  // API key is only added server-side in clientConfig
  const nodeUrl = getGeomiNodeUrl();
  if (nodeUrl) {
    if (isServer) {
      console.log(`[Aptos] Using Geomi node URL with API key: ${nodeUrl}`);
    } else {
      console.log(`[Aptos] Using Geomi node URL (client-side, no API key): ${nodeUrl}`);
    }
    return new AptosConfig({
      fullnode: nodeUrl,
      network,
      clientConfig, // API key only included server-side
    });
  }

  // Default configuration (with API key on server-side only)
  return new AptosConfig({
    network,
    clientConfig,
  });
};

// Lazy initialization of Aptos client to avoid calling getChainId() on client-side
// getChainId() is called during initialization and makes an API call
let aptosClientInstance: Aptos | null = null;

function getAptosClient(): Aptos {
  // Only initialize on server-side to avoid client-side API calls
  if (typeof window !== "undefined") {
    throw new Error("aptosClient should only be used server-side. Use API routes for client-side operations.");
  }

  if (!aptosClientInstance) {
    const config = buildAptosConfig();
    aptosClientInstance = new Aptos(config);
  }
  return aptosClientInstance;
}

// Export as a getter to delay initialization
// Only initialize on server-side - client-side should use API routes
export const aptosClient = new Proxy({} as Aptos, {
  get(_target, prop) {
    // Prevent any access on client-side
    if (typeof window !== "undefined") {
      throw new Error(
        "aptosClient cannot be used on client-side. " +
        "Use API routes (e.g., /api/account/balance) for client-side operations."
      );
    }
    const client = getAptosClient();
    const value = client[prop as keyof Aptos];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

// Log configuration on startup (server-side only)
const logConfiguration = () => {
  // Only log on server-side to avoid exposing env vars in client bundle
  if (typeof window !== "undefined") {
    return; // Client-side - skip logging
  }

  const apiKey = getGeomiApiKey();
  const nodeUrl = getGeomiNodeUrl();
  const faucetUrl = getGeomiFaucetUrl();

  if (apiKey) {
    const source = process.env.GEOMI_API_KEY ? 'GEOMI_API_KEY' : 'APTOS_API_KEY';
    console.log(`[Aptos] ✅ Geomi API key configured (from ${source}): ${apiKey.slice(0, 8)}...`);
    if (nodeUrl) {
      const urlSource = process.env.GEOMI_NODE_URL ? 'GEOMI_NODE_URL' : 'APTOS_NODE_URL';
      console.log(`[Aptos] Using node URL (from ${urlSource}): ${nodeUrl}`);
    }
    if (faucetUrl) {
      const faucetSource = process.env.GEOMI_FAUCET_URL ? 'GEOMI_FAUCET_URL' : 'APTOS_FAUCET_URL';
      console.log(`[Aptos] Using faucet URL (from ${faucetSource}): ${faucetUrl}`);
    }
  } else {
    console.log(`[Aptos] ⚠️  API key not found - checking environment...`);
    console.log(`[Aptos]   GEOMI_API_KEY: ${process.env.GEOMI_API_KEY ? '✅ set' : '❌ not set'}`);
    console.log(`[Aptos]   APTOS_API_KEY: ${process.env.APTOS_API_KEY ? '✅ set' : '❌ not set'}`);
    console.log(`[Aptos]   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`[Aptos] ⚠️  Faucet may not work on testnet without API key`);
  }
  console.log(`[Aptos] Network: ${getNetwork()}`);
};

// Call on module load (only logs on server-side)
logConfiguration();

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
  // Server-side only - this uses aptosClient
  if (typeof window !== "undefined") {
    throw new Error("getAccountBalance can only be called server-side. Use /api/account/balance for client-side.");
  }

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
  // Server-side only - this uses aptosClient
  if (typeof window !== "undefined") {
    throw new Error("viewPokerContract can only be called server-side");
  }

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
 * Client-safe: doesn't require API keys
 */
export function getExplorerUrl(txHash: string): string {
  // Use NEXT_PUBLIC_ env var if available (client-side), otherwise fall back to server-side
  const networkEnv = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_APTOS_NETWORK
    : process.env.APTOS_NETWORK;

  const network = networkEnv?.toLowerCase() || "testnet";
  const networkParam = network === "mainnet" ? "mainnet" : "testnet";
  return `https://explorer.aptoslabs.com/txn/${txHash}?network=${networkParam}`;
}

/**
 * Get explorer URL for account
 * Client-safe: doesn't require API keys
 */
export function getAccountExplorerUrl(address: string): string {
  // Use NEXT_PUBLIC_ env var if available (client-side), otherwise fall back to server-side
  const networkEnv = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_APTOS_NETWORK
    : process.env.APTOS_NETWORK;

  const network = networkEnv?.toLowerCase() || "testnet";
  const networkParam = network === "mainnet" ? "mainnet" : "testnet";
  return `https://explorer.aptoslabs.com/account/${address}?network=${networkParam}`;
}

/**
 * Fund an account from faucet
 * 
 * NOTE: Geomi is a node provider, not a faucet provider.
 * On testnet, programmatic faucet funding is not available.
 * Users should use wallet transfers or the manual faucet.
 * 
 * Server-side only - API keys are not exposed to client
 */
export async function fundFromFaucetAPI(address: string, amount = 100_000_000): Promise<boolean> {
  // Server-side only check
  if (typeof window !== "undefined") {
    throw new Error("Faucet funding is server-side only");
  }

  const network = getNetwork();

  if (network === Network.MAINNET) {
    throw new Error("Faucet not available on mainnet");
  }

  // Clean the address
  const cleanAddress = address.startsWith("0x") ? address : `0x${address}`;

  console.log(`[Faucet] Attempting to fund ${cleanAddress} with ${amount} octas on ${network}`);

  // Try Devnet faucet (works programmatically)
  if (network === Network.DEVNET) {
    try {
      const faucetUrl = `https://faucet.devnet.aptoslabs.com/mint?amount=${amount}&address=${cleanAddress}`;
      const response = await fetch(faucetUrl, { method: "POST" });

      if (response.ok) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log(`[Faucet] ✅ Successfully funded ${cleanAddress} from Devnet faucet`);
        return true;
      } else {
        const errorText = await response.text();
        throw new Error(`Devnet faucet error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`[Faucet] Devnet faucet failed:`, error);
      throw new Error(
        `Failed to fund from Devnet faucet. Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Testnet: No programmatic faucet available
  // Geomi is a node provider, not a faucet provider
  throw new Error(
    `Programmatic faucet funding is not available on Testnet.\n\n` +
    `Options:\n` +
    `1. Use wallet transfer: Connect your wallet and use "From Wallet" button\n` +
    `2. Manual faucet: Visit https://aptos.dev/en/network/faucet (requires login)\n` +
    `3. Switch to Devnet: Set APTOS_NETWORK=devnet in .env for programmatic funding`
  );
}

// Removed tryGeomiFaucet - Geomi is a node provider, not a faucet provider

/**
 * Try a specific faucet endpoint with various formats
 */
async function tryFaucetEndpoint(faucetUrl: string, address: string, amount: number): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add API key if available (Geomi)
  const apiKey = getGeomiApiKey();
  if (apiKey) {
    headers["X-API-KEY"] = apiKey;
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // Try /mint endpoint first (standard format)
  try {
    const mintResponse = await fetch(`${faucetUrl}/mint?amount=${amount}&address=${address}`, {
      method: "POST",
      headers,
    });

    if (mintResponse.ok) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(`[Faucet] Successfully funded ${address} with ${amount} octas via ${faucetUrl}/mint`);
      return true;
    }
  } catch {
    // Try next format
  }

  // Try /fund endpoint (alternative format)
  try {
    const fundResponse = await fetch(`${faucetUrl}/fund`, {
      method: "POST",
      headers,
      body: JSON.stringify({ address, amount }),
    });

    if (fundResponse.ok) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(`[Faucet] Successfully funded ${address} with ${amount} octas via ${faucetUrl}/fund`);
      return true;
    }
  } catch {
    // Try next format
  }

  return false;
}

/**
 * Get current network name for display
 */
export function getNetworkName(): string {
  const network = getNetwork();
  switch (network) {
    case Network.MAINNET: return "mainnet";
    case Network.DEVNET: return "devnet";
    case Network.TESTNET: return "testnet";
    default: return "testnet";
  }
}

