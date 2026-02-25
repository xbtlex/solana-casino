/**
 * Payout Service - Handles sending winnings from house wallet to players
 *
 * This module provides functions to request payouts from the house wallet.
 * In production, this would call a secure backend API that has access to the house wallet.
 */

import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from "@solana/web3.js"
import { COMMITMENT } from "../config/solana-config"

// Payout request interface
export interface PayoutRequest {
    playerWallet: string
    amount: number // in SOL
    gameId: string
    blockhash: string
    slot: number
}

export interface PayoutResponse {
    success: boolean
    signature?: string
    error?: string
}

// For local development/testing - load house wallet from environment or file
// WARNING: Never expose private keys in frontend code in production!
const getHouseKeypair = (): Keypair | null => {
    // Check if we have a house wallet secret key in localStorage (for testing only)
    const secretKeyString = localStorage.getItem("HOUSE_WALLET_SECRET_KEY")
    if (secretKeyString) {
        try {
            const secretKey = JSON.parse(secretKeyString)
            return Keypair.fromSecretKey(new Uint8Array(secretKey))
        } catch {
            console.error("Failed to parse house wallet secret key")
        }
    }
    return null
}

/**
 * Process a payout from the house wallet to a winning player
 *
 * @param connection - Solana connection
 * @param request - Payout request details
 * @returns PayoutResponse with transaction signature or error
 */
export const processPayout = async (connection: Connection, request: PayoutRequest): Promise<PayoutResponse> => {
    try {
        // Try to get house keypair for local testing
        const houseKeypair = getHouseKeypair()

        if (houseKeypair) {
            // Local mode: Send payout directly from house wallet
            console.log(`Processing local payout of ${request.amount} SOL to ${request.playerWallet}`)

            const playerPubkey = new PublicKey(request.playerWallet)
            const lamports = Math.floor(request.amount * 1e9)

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: houseKeypair.publicKey,
                    toPubkey: playerPubkey,
                    lamports
                })
            )

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(COMMITMENT)
            transaction.recentBlockhash = blockhash
            transaction.feePayer = houseKeypair.publicKey

            // Sign with house wallet
            transaction.sign(houseKeypair)

            // Send and confirm
            const signature = await connection.sendRawTransaction(transaction.serialize())

            await connection.confirmTransaction(
                {
                    signature,
                    blockhash,
                    lastValidBlockHeight
                },
                COMMITMENT
            )

            console.log(`Payout successful! Signature: ${signature}`)

            return {
                success: true,
                signature
            }
        } else {
            // Production mode: Call backend API
            // This would be your secure backend server with the house wallet
            const apiUrl = import.meta.env.VITE_PAYOUT_API_URL || "http://localhost:3001/api/payout"

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(request)
            })

            if (!response.ok) {
                throw new Error(`Payout API returned ${response.status}`)
            }

            const data = await response.json()
            return data as PayoutResponse
        }
    } catch (error: any) {
        console.error("Payout failed:", error)
        return {
            success: false,
            error: error.message || "Failed to process payout"
        }
    }
}

/**
 * Queue a payout for processing
 * Used when payouts need to be batched or processed asynchronously
 */
export const queuePayout = async (
    request: PayoutRequest
): Promise<{ queued: boolean; id?: string; error?: string }> => {
    try {
        // Store in localStorage for demo purposes
        // In production, this would be sent to a backend queue
        const pendingPayouts = JSON.parse(localStorage.getItem("pendingPayouts") || "[]")
        const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        pendingPayouts.push({
            id: payoutId,
            ...request,
            status: "pending",
            createdAt: Date.now()
        })

        localStorage.setItem("pendingPayouts", JSON.stringify(pendingPayouts))

        return {
            queued: true,
            id: payoutId
        }
    } catch (error: any) {
        return {
            queued: false,
            error: error.message
        }
    }
}

/**
 * Get pending payouts for admin review
 */
export const getPendingPayouts = (): PayoutRequest[] => {
    try {
        return JSON.parse(localStorage.getItem("pendingPayouts") || "[]")
    } catch {
        return []
    }
}
