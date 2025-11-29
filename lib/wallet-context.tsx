"use client";

/**
 * Wallet Context Provider
 * 
 * Provides Aptos wallet connection functionality using Petra wallet adapter
 */

import { createContext, useContext, ReactNode } from "react";
import { AptosWalletAdapterProvider, useWallet } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";

// Get network from environment
const getNetwork = (): Network => {
  const network = process.env.NEXT_PUBLIC_APTOS_NETWORK?.toLowerCase();
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

interface WalletContextType {
  connected: boolean;
  address: string | null;
  balance: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSubmitTransaction: (transaction: any) => Promise<any>;
}

const WalletContext = createContext<WalletContextType | null>(null);

/**
 * Inner provider that uses the wallet adapter hooks
 */
function WalletContextInner({ children }: { children: ReactNode }) {
  const {
    connected,
    account,
    connect,
    disconnect,
    signAndSubmitTransaction,
  } = useWallet();

  const value: WalletContextType = {
    connected,
    address: account?.address?.toString() || null,
    balance: 0, // Will be fetched separately when needed
    connect: async () => {
      await connect("Petra");
    },
    disconnect: async () => {
      await disconnect();
    },
    signAndSubmitTransaction: async (transaction: any) => {
      return signAndSubmitTransaction(transaction);
    },
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

/**
 * Wallet Provider Component
 * Wraps the app with Aptos wallet adapter and custom context
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{
        network: getNetwork(),
        aptosConnect: { dappId: "x402-poker" },
      }}
      optInWallets={["Petra"]}
      onError={(error) => {
        console.error("[WalletProvider] Error:", error);
      }}
    >
      <WalletContextInner>{children}</WalletContextInner>
    </AptosWalletAdapterProvider>
  );
}

/**
 * Hook to access wallet context
 */
export function useWalletContext(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
}

// Re-export useWallet for direct access to adapter functionality
export { useWallet } from "@aptos-labs/wallet-adapter-react";

