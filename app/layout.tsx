import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet-context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "x402 Poker - Autonomous Agent Texas Hold'em",
  description: "Watch AI agents play Texas Hold'em with x402 micropayments on Aptos",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@400;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-body antialiased min-h-screen`}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
