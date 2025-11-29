/**
 * x402 Payment Integration
 * 
 * This module integrates payments for the poker game using the aptos-x402 SDK.
 * 
 * ARCHITECTURE:
 * ============
 * 
 * 1. DIRECT APT TRANSFERS (used for game mechanics):
 *    - Agent buy-ins to game escrow
 *    - Bet payments during gameplay  
 *    - Pot distributions to winners
 *    - Agent wallet funding
 * 
 * 2. X402 PROTOCOL (HTTP 402 Payment Required):
 *    The x402 protocol is designed for machine-to-machine API payments.
 *    Potential use cases in poker:
 *    - Pay-per-game spectator access
 *    - Premium API endpoints
 *    - Pay-to-create custom tournaments
 * 
 * This module uses utilities from the 'aptos-x402' package and provides
 * additional functions specific to poker game payments.
 */

import {
  Account,
  Ed25519PrivateKey,
  AccountAddress,
} from "@aptos-labs/ts-sdk";

// Import utilities from aptos-x402 package
import {
  getAptosClient,
  getAccountFromPrivateKey,
  signAndSubmitPayment,
  getAccountBalance,
} from "aptos-x402";

// Public x402 Facilitator URL (for HTTP 402 payment protocol)
const X402_FACILITATOR_URL = process.env.FACILITATOR_URL || "https://aptos-x402.vercel.app/api/facilitator";

// Get the network from environment
const network = process.env.APTOS_NETWORK || "testnet";

// Initialize Aptos client using aptos-x402 utility
const aptos = getAptosClient(network);

// Types for game payments
export interface PaymentRequest {
  from: string;
  to: string;
  amount: number;
  memo?: string;
}

export interface PaymentReceipt {
  txHash: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  facilitatorSignature?: string;
  status: "pending" | "confirmed" | "failed";
}

export interface FacilitatorReceipt {
  receiptId: string;
  txHash: string;
  amount: number;
  from: string;
  to: string;
  signature: string;
  timestamp: number;
}

export interface FacilitatorPaymentRequest {
  from: string;
  to: string;
  amount: number;
  memo?: string;
  signedTransaction?: string;
}

export interface FacilitatorPaymentResponse {
  success: boolean;
  receipt?: FacilitatorReceipt;
  txHash?: string;
  error?: string;
}

/**
 * Create an Aptos account from a private key
 * Uses the aptos-x402 utility function
 */
export function createAccountFromPrivateKey(privateKeyHex: string): Account {
  try {
    // Use aptos-x402 utility
    return getAccountFromPrivateKey(privateKeyHex);
  } catch {
    // Fallback to direct creation if aptos-x402 format differs
    const cleanKey = privateKeyHex.startsWith("0x") 
      ? privateKeyHex.slice(2) 
      : privateKeyHex;
    const privateKey = new Ed25519PrivateKey(cleanKey);
    return Account.fromPrivateKey({ privateKey });
  }
}

/**
 * Get account balance using aptos-x402 utility
 */
export async function getBalance(address: string): Promise<number> {
  try {
    const balance = await getAccountBalance(aptos, address);
    return parseInt(balance, 10);
  } catch {
    // Fallback: try direct API call
    try {
      const resources = await aptos.getAccountResources({
        accountAddress: AccountAddress.from(address),
      });
      
      const coinResource = resources.find(
        (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );
      
      if (!coinResource) return 0;
      
      return parseInt((coinResource.data as { coin: { value: string } }).coin.value, 10);
    } catch {
      return 0;
    }
  }
}

/**
 * Transfer APT tokens directly using aptos-x402 utility
 */
export async function transfer(
  sender: Account,
  recipient: string,
  amount: number
): Promise<PaymentReceipt> {
  try {
    // Use aptos-x402 signAndSubmitPayment
    const txHash = await signAndSubmitPayment(
      aptos,
      sender,
      recipient,
      amount.toString()
    );

    return {
      txHash,
      from: sender.accountAddress.toString(),
      to: recipient,
      amount,
      timestamp: Date.now(),
      status: "confirmed",
    };
  } catch (error) {
    console.error("[x402] Transfer failed:", error);
    throw error;
  }
}

/**
 * Submit payment through x402 facilitator (for HTTP 402 protocol)
 * This is for API payment scenarios, not direct game transfers
 */
export async function submitToFacilitator(
  request: FacilitatorPaymentRequest
): Promise<FacilitatorPaymentResponse> {
  try {
    const response = await fetch(X402_FACILITATOR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Facilitator error: ${response.status} - ${error}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      receipt: data.receipt,
      txHash: data.txHash,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Facilitator request failed",
    };
  }
}

/**
 * Create a payment for game buy-in
 * Uses direct transfer for reliability
 */
export async function createBuyInPayment(
  agent: Account,
  escrowAddress: string,
  amount: number,
  gameId: string
): Promise<PaymentReceipt> {
  console.log(`[x402] Creating buy-in payment: ${amount} to ${escrowAddress} for game ${gameId}`);
  
  // Use direct transfer for game buy-ins (more reliable)
  return transfer(agent, escrowAddress, amount);
}

/**
 * Create a payment for a bet
 * Uses direct transfer for speed and reliability
 */
export async function createBetPayment(
  agent: Account,
  potAddress: string,
  amount: number,
  gameId: string,
  action: string
): Promise<PaymentReceipt> {
  console.log(`[x402] Creating bet payment: ${amount} for ${action} in game ${gameId}`);
  
  // Use direct transfer for bets
  return transfer(agent, potAddress, amount);
}

/**
 * Verify a facilitator receipt
 */
export async function verifyFacilitatorReceipt(
  receipt: FacilitatorReceipt
): Promise<boolean> {
  try {
    // Verify with facilitator
    const response = await fetch(`${X402_FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ receipt }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.valid === true;
    }

    // Fallback: basic validation
    if (!receipt.txHash || !receipt.signature || !receipt.amount) {
      return false;
    }

    return true;
  } catch {
    // Basic validation on error
    return receipt.txHash?.length > 0 && receipt.amount > 0;
  }
}

/**
 * Distribute pot winnings to winners
 */
export async function distributePot(
  escrowAccount: Account,
  winners: { address: string; amount: number }[]
): Promise<PaymentReceipt[]> {
  const receipts: PaymentReceipt[] = [];
  
  for (const winner of winners) {
    console.log(`[x402] Distributing ${winner.amount} to ${winner.address}`);
    
    const receipt = await transfer(escrowAccount, winner.address, winner.amount);
    receipts.push(receipt);
  }
  
  return receipts;
}

/**
 * Fund an agent wallet from faucet
 * 
 * IMPORTANT: 
 * - DEVNET faucet works programmatically via API
 * - TESTNET faucet requires manual authentication at https://aptos.dev/en/network/faucet
 */
export async function fundFromFaucet(address: string, amount = 100_000_000): Promise<void> {
  if (network !== "testnet" && network !== "devnet") {
    throw new Error("Faucet only available on testnet/devnet");
  }
  
  // Clean the address
  const cleanAddress = address.startsWith("0x") ? address : `0x${address}`;
  
  // Testnet requires manual authentication
  if (network === "testnet") {
    console.log(`[x402] Testnet faucet requires manual authentication`);
    
    // Try anyway in case it works
    const faucetUrl = "https://faucet.testnet.aptoslabs.com";
    try {
      const response = await fetch(`${faucetUrl}/mint?amount=${amount}&address=${cleanAddress}`, {
        method: "POST",
      });
      
      if (response.ok) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log(`[x402] Funded ${address} with ${amount} octas from faucet`);
        return;
      }
    } catch {
      // Expected to fail for testnet
    }
    
    throw new Error(
      `Testnet faucet requires manual authentication. ` +
      `Please visit https://aptos.dev/en/network/faucet or fund via wallet transfer.`
    );
  }
  
  // Devnet faucet works programmatically
  const faucetUrl = "https://faucet.devnet.aptoslabs.com";
  
  try {
    const response = await fetch(`${faucetUrl}/mint?amount=${amount}&address=${cleanAddress}`, {
      method: "POST",
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Faucet request failed: ${response.status} - ${errorText}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`[x402] Funded ${address} with ${amount} octas from faucet`);
  } catch (error) {
    console.error(`[x402] Faucet error for ${address}:`, error);
    throw error;
  }
}

/**
 * Get transaction details from hash
 */
export async function getTransaction(txHash: string) {
  return aptos.getTransactionByHash({ transactionHash: txHash });
}

/**
 * Get Aptos explorer URL for a transaction
 */
export function getExplorerUrl(txHash: string): string {
  return `https://explorer.aptoslabs.com/txn/${txHash}?network=${network}`;
}

/**
 * Sign a message with an account (for thought signatures)
 */
export function signMessage(account: Account, message: string): string {
  const messageBytes = new TextEncoder().encode(message);
  const signature = account.sign(messageBytes);
  return signature.toString();
}

/**
 * Get facilitator URL
 */
export function getFacilitatorUrl(): string {
  return X402_FACILITATOR_URL;
}

/**
 * Get current network
 */
export function getNetwork(): string {
  return network;
}

// Export the Aptos client for direct access if needed
export { aptos };

// Re-export x402axios for use in client components that need to pay for APIs
export { x402axios } from "aptos-x402";
