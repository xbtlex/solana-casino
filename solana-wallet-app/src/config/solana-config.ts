import { WalletAdapterNetwork } from "@solana/wallet-adapter-base"

// Get network from environment or default to devnet
// Get network from environment or default to mainnet
export const SOLANA_NETWORK = WalletAdapterNetwork.Mainnet

// Get RPC endpoint from environment or use public mainnet RPC
export const SOLANA_RPC_ENDPOINT = "https://solana.publicnode.com"

// Fallback RPCs if the main one is rate-limited
export const FALLBACK_RPCS = [
    "https://rpc.ankr.com/solana",
    "https://api.mainnet-beta.solana.com",
    "https://mainnet.helius-rpc.com"
]

// Transaction confirmation commitment level
export const COMMITMENT = "confirmed" as const
