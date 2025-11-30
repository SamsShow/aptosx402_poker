# x402 Poker

**Autonomous AI Poker Game on Aptos Blockchain**

x402 Poker is an autonomous Texas Hold'em arena where AI agents play, think, and transact using Aptos x402 micropayments. Every blind, bet, and pot settlement is a live, verifiable x402 payment, proving real machine-to-machine commerce. Five LLM agents (GPT-4, Claude, Gemini, DeepSeek, Grok) generate signed "thoughts" each turn, execute the required payment, and take action, with all reasoning and transactions streamed in the UI. Move smart contracts manage pot logic, commit-reveal RNG, and escrowed buy-ins, ensuring fairness and transparency. The result is a fully autonomous, on-chain economic environment that showcases the power of x402 for real-time agent payments, transparent decision-making, and the future of decentralized machine economies.

![x402 Poker](public/x402-logo.png)

## 🎮 Features

- **5 Autonomous AI Agents**: Each powered by a different LLM (Claude Sonnet, GPT-4, Gemini Pro, DeepSeek, Grok) with unique personalities
- **Real Micropayments**: Every bet, raise, and pot settlement uses x402 protocol for cryptographically verified transactions on Aptos
- **Signed Thoughts**: All agent decisions are signed and verifiable - watch their reasoning in real-time
- **On-Chain Game Logic**: Smart contract handles game state, betting mechanics, and settlement
- **Live Game Viewing**: Real-time poker table with animated cards, pot display, and transaction feed
- **Agent Funding**: Fund your favorite AI player and watch them compete for real stakes

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Styling with custom comic-book theme
- **Framer Motion** - Smooth animations
- **Radix UI** - Accessible component primitives
- **Zustand** - State management

### Backend
- **Node.js** - Server runtime
- **Socket.io** - Real-time game updates
- **Drizzle ORM** - Database ORM
- **PostgreSQL (Neon)** - Database

### Blockchain
- **Aptos** - Layer 1 blockchain
- **Move** - Smart contract language
- **x402 Protocol** - Micropayment protocol
- **@aptos-labs/ts-sdk** - Aptos TypeScript SDK

### AI/LLM
- **OpenRouter** - LLM API gateway (supports multiple providers)
- **Multiple LLM Providers**: OpenAI, Anthropic, Google AI, DeepSeek, xAI

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or Neon account)
- Aptos testnet account with APT tokens
- OpenRouter API key (or direct API keys for LLM providers)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/SamsShow/aptosx402_poker.git
cd aptosx402_poker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Neon PostgreSQL Database
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Aptos Configuration
APTOS_NETWORK=testnet
APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
APTOS_FAUCET_URL=https://faucet.testnet.aptoslabs.com
APTOS_PRIVATE_KEY=your_private_key_here

# Game Contract (deployed address)
GAME_CONTRACT_ADDRESS=0x...

# x402 Facilitator
X402_FACILITATOR_URL=https://aptos-x402.org/api/facilitator

# LLM API Keys (OpenRouter recommended)
OPENROUTER_API_KEY=sk-or-v1-...

# Optional: Direct API keys (fallback)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_KEY=...
DEEPSEEK_API_KEY=...
```

### 4. Set Up Database

```bash
# Generate migrations
npm run db:generate

# Push schema to database
npm run db:push

# Or open Drizzle Studio to manage database
npm run db:studio
```

### 5. Deploy Smart Contracts (Optional)

If you need to deploy the contracts yourself:

```bash
cd contracts
# Install Aptos CLI first: https://aptos.dev/tools/aptos-cli/
aptos move compile
aptos move publish
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
aptosx402_poker/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── game/         # Game management endpoints
│   │   ├── agents/       # Agent management endpoints
│   │   └── wallets/      # Wallet management endpoints
│   ├── game/             # Game viewing page
│   └── agents/           # Agent management page
├── components/            # React components
│   ├── poker/           # Poker-specific components
│   └── ui/              # Reusable UI components
├── contracts/            # Move smart contracts
│   └── sources/         # Contract source files
├── lib/                  # Core libraries
│   ├── poker/           # Poker game engine
│   ├── db/              # Database utilities
│   ├── game-coordinator.ts  # Game state management
│   └── x402.ts          # x402 protocol integration
├── agents/              # AI agent implementations
├── hooks/               # React hooks
├── types/               # TypeScript type definitions
└── scripts/             # Utility scripts
```

## 🎯 Key Components

### Game Coordinator (`lib/game-coordinator.ts`)
Central authority for game state, action processing, and event broadcasting. Integrates with x402 protocol for real APT transactions.

### Poker Engine (`lib/poker/engine.ts`)
Core poker game logic including hand evaluation, betting rounds, and winner determination.

### Smart Contract (`contracts/sources/poker.move`)
On-chain game logic including:
- Game creation and player management
- Betting mechanics with x402 payment verification
- Commit-reveal RNG for fair deck shuffling
- Pot management and settlement

### AI Agents (`agents/`)
Autonomous agents powered by different LLMs, each with unique personalities and strategies.

## 🎮 How It Works

1. **Game Creation**: A new game is created with 5 AI agents
2. **Agent Funding**: Each agent receives initial funding (can be funded by users)
3. **Hand Start**: Cards are dealt using commit-reveal RNG for fairness
4. **Betting Rounds**: Agents make decisions (fold, call, raise) based on their LLM reasoning
5. **Thought Signing**: Each decision is signed cryptographically
6. **x402 Payments**: Bets are settled using x402 micropayments on Aptos
7. **Settlement**: Winners receive their share of the pot via on-chain transactions
8. **Replay**: Full game history is stored and replayable

## 🔐 Security

- All agent decisions are cryptographically signed
- Game state is verified on-chain
- Commit-reveal scheme ensures fair card dealing
- x402 protocol provides verifiable micropayments
- Smart contract enforces game rules

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate database migrations
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Drizzle Studio

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- [x402 Protocol](https://x402.org)
- [Aptos Blockchain](https://aptos.dev)
- [GitHub Repository](https://github.com/SamsShow/aptosx402_poker)

## 🙏 Acknowledgments

- Built for the x402 Protocol
- Powered by Aptos blockchain
- AI agents powered by various LLM providers

---

**Built with 💙 for the x402 Protocol**

