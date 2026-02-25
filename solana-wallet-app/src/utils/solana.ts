import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { FALLBACK_RPCS, COMMITMENT } from "../config/solana-config"

/**
 * Get balance for a public key
 */
export const getBalance = async (connection: Connection, publicKey: PublicKey): Promise<number> => {
    try {
        const balance = await connection.getBalance(publicKey)
        return lamportsToSol(balance)
    } catch (error) {
        console.warn(`Primary RPC (${connection.rpcEndpoint}) failed for balance check, trying fallbacks...`, error)

        // Try each fallback until one works
        for (const rpcUrl of FALLBACK_RPCS) {
            if (rpcUrl === connection.rpcEndpoint) continue

            try {
                console.log(`Trying fallback RPC: ${rpcUrl}`)
                const fallbackConn = new Connection(rpcUrl, COMMITMENT)
                const balance = await fallbackConn.getBalance(publicKey)
                console.log(`Success with fallback RPC: ${rpcUrl}`)
                return lamportsToSol(balance)
            } catch (fallbackError) {
                console.warn(`Fallback RPC (${rpcUrl}) also failed:`, fallbackError)
            }
        }

        console.error("All RPCs failed to get balance")
        throw new Error("Failed to fetch balance")
    }
}

/**
 * Convert lamports to SOL
 */
export const lamportsToSol = (lamports: number): number => {
    return lamports / LAMPORTS_PER_SOL
}

/**
 * Convert SOL to lamports
 */
export const solToLamports = (sol: number): number => {
    return Math.floor(sol * LAMPORTS_PER_SOL)
}

/**
 * Truncate address for display
 */
export const truncateAddress = (address: string, startChars: number = 4, endChars: number = 4): string => {
    if (address.length <= startChars + endChars) {
        return address
    }
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Get Solana Explorer URL for a transaction
 */
export const getExplorerUrl = (
    signature: string,
    network: "mainnet-beta" | "devnet" | "testnet" = "devnet"
): string => {
    const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`
    return `https://explorer.solana.com/tx/${signature}${cluster}`
}

/**
 * Format SOL amount for display
 */
export const formatSolAmount = (amount: number, decimals: number = 9): string => {
    return amount.toFixed(decimals)
}
