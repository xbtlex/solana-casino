import { Connection } from "@solana/web3.js"
import { COMMITMENT } from "../config/solana-config"

/**
 * Generate a provably fair coin flip result using Solana blockhash
 * This is more transparent than client-side randomness
 * @param connection - Solana connection
 * @param winChance - Percentage chance to win (0-100)
 * @param userSeed - Optional user-provided seed for extra entropy
 */
export const generateProvablyFairResult = async (
    connection: Connection,
    winChance: number = 50,
    userSeed?: string
): Promise<{
    result: "heads" | "tails"
    won: boolean
    blockhash: string
    slot: number
    seed: string
}> => {
    // Get the latest blockhash - this serves as our random seed
    const { blockhash } = await connection.getLatestBlockhash(COMMITMENT)

    // Get current slot for additional entropy
    const slot = await connection.getSlot(COMMITMENT)

    // Combine blockhash, slot, and optional user seed
    const combinedSeed = userSeed ? `${blockhash}-${slot}-${userSeed}` : `${blockhash}-${slot}`

    // Hash the combined seed to get a number
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(combinedSeed))

    // Convert first byte to number (0-255)
    const hashArray = new Uint8Array(hash)
    const randomValue = hashArray[0]

    // Convert to percentage (0-100)
    const randomPercent = (randomValue / 255) * 100

    // Determine if player won based on win chance
    const won = randomPercent < winChance

    // For display purposes, still show heads/tails
    // If win chance is 50%, it's a true coin flip
    // Otherwise, we determine result based on win condition
    const result: "heads" | "tails" = won ? "heads" : "tails"

    return {
        result,
        won,
        blockhash,
        slot,
        seed: combinedSeed
    }
}

/**
 * Verify a game result using the seed
 */
export const verifyResult = async (seed: string, expectedResult: "heads" | "tails"): Promise<boolean> => {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed))

    const hashArray = new Uint8Array(hash)
    const randomValue = hashArray[0]
    const result: "heads" | "tails" = randomValue < 128 ? "heads" : "tails"

    return result === expectedResult
}
