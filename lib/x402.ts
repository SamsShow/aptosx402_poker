/**
 * x402 Payment Integration
 * 
 * Uses the public x402 facilitator for poker game payments:
 * - Buy-in payments to escrow
 * - Bet payments with facilitator receipts
 * - Receipt verification
 * - Payout distributions
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  AccountAddress,
} from "@aptos-labs/ts-sdk";

// Public x402 Facilitator URL
const X402_FACILITATOR_URL = "https://aptos-x402.vercel.app/api/facilitator";

// Types for x402 payments
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

// Configuration
const config = new AptosConfig({
  network: (process.env.APTOS_NETWORK as Network) || Network.TESTNET,
});

const aptos = new Aptos(config);

/**
 * Create an Aptos account from a private key
 */
export function createAccountFromPrivateKey(privateKeyHex: string): Account {
  const cleanKey = privateKeyHex.startsWith("0x") 
    ? privateKeyHex.slice(2) 
    : privateKeyHex;
  const privateKey = new Ed25519PrivateKey(cleanKey);
  return Account.fromPrivateKey({ privateKey });
}

/**
 * Get account balance
 */
export async function getBalance(address: string): Promise<number> {
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

/**
 * Transfer APT tokens directly (without facilitator)
 */
export async function transfer(
  sender: Account,
  recipient: string,
  amount: number
): Promise<PaymentReceipt> {
  const transaction = await aptos.transaction.build.simple({
    sender: sender.accountAddress,
    data: {
      function: "0x1::aptos_account::transfer",
      functionArguments: [AccountAddress.from(recipient), amount],
    },
  });

  const pendingTx = await aptos.signAndSubmitTransaction({
    signer: sender,
    transaction,
  });

  const executedTx = await aptos.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  return {
    txHash: pendingTx.hash,
    from: sender.accountAddress.toString(),
    to: recipient,
    amount,
    timestamp: Date.now(),
    status: executedTx.success ? "confirmed" : "failed",
  };
}

/**
 * Submit payment through x402 facilitator
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
 * Create a payment for game buy-in using facilitator
 */
export async function createBuyInPayment(
  agent: Account,
  escrowAddress: string,
  amount: number,
  gameId: string
): Promise<PaymentReceipt> {
  console.log(`[x402] Creating buy-in payment: ${amount} to ${escrowAddress} for game ${gameId}`);
  
  // Try facilitator first
  const facilitatorResponse = await submitToFacilitator({
    from: agent.accountAddress.toString(),
    to: escrowAddress,
    amount,
    memo: `buy_in:${gameId}`,
  });

  if (facilitatorResponse.success && facilitatorResponse.receipt) {
    return {
      txHash: facilitatorResponse.txHash || facilitatorResponse.receipt.txHash,
      from: agent.accountAddress.toString(),
      to: escrowAddress,
      amount,
      timestamp: Date.now(),
      facilitatorSignature: facilitatorResponse.receipt.signature,
      status: "confirmed",
    };
  }

  // Fallback to direct transfer
  console.log(`[x402] Facilitator unavailable, using direct transfer`);
  return transfer(agent, escrowAddress, amount);
}

/**
 * Create a payment for a bet using facilitator
 */
export async function createBetPayment(
  agent: Account,
  potAddress: string,
  amount: number,
  gameId: string,
  action: string
): Promise<PaymentReceipt> {
  console.log(`[x402] Creating bet payment: ${amount} for ${action} in game ${gameId}`);
  
  // Try facilitator for micropayments
  const facilitatorResponse = await submitToFacilitator({
    from: agent.accountAddress.toString(),
    to: potAddress,
    amount,
    memo: `bet:${gameId}:${action}`,
  });

  if (facilitatorResponse.success && facilitatorResponse.receipt) {
    return {
      txHash: facilitatorResponse.txHash || facilitatorResponse.receipt.txHash,
      from: agent.accountAddress.toString(),
      to: potAddress,
      amount,
      timestamp: Date.now(),
      facilitatorSignature: facilitatorResponse.receipt.signature,
      status: "confirmed",
    };
  }

  // Fallback to direct transfer
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
 * Fund an agent wallet from faucet (testnet only)
 */
export async function fundFromFaucet(address: string, amount = 100_000_000): Promise<void> {
  if (process.env.APTOS_NETWORK !== "testnet" && process.env.APTOS_NETWORK !== "devnet") {
    throw new Error("Faucet only available on testnet/devnet");
  }
  
  await aptos.fundAccount({
    accountAddress: AccountAddress.from(address),
    amount,
  });
  
  console.log(`[x402] Funded ${address} with ${amount} octas from faucet`);
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
  const network = process.env.APTOS_NETWORK || "testnet";
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

// Export the Aptos client for direct access if needed
export { aptos, config };
