/**
 * Solana Coin Flip - Payout Server
 *
 * This server handles payouts from the house wallet to winning players.
 * It holds the house wallet's private key securely and processes payout requests.
 */

require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require("@solana/web3.js")
const bs58 = require("bs58")

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    })
)
app.use(express.json())

// Solana connection URLs to try
const RPC_URLS = [
    process.env.SOLANA_RPC_URL,
    "https://api.mainnet-beta.solana.com",
    "https://solana-mainnet.rpc.extrnode.com",
    "https://rpc.ankr.com/solana"
].filter(Boolean)

let connection = new Connection(RPC_URLS[0], "confirmed")

// Function to refresh connection if it fails
const rotateConnection = () => {
    const currentIndex = RPC_URLS.indexOf(connection.rpcEndpoint)
    const nextIndex = (currentIndex + 1) % RPC_URLS.length
    console.log(`🔄 Rotating to RPC: ${RPC_URLS[nextIndex]}`)
    connection = new Connection(RPC_URLS[nextIndex], "confirmed")
}

// Load house wallet from environment
let houseKeypair = null

const loadHouseWallet = () => {
    const privateKey = process.env.HOUSE_WALLET_PRIVATE_KEY

    // Check if key is missing or is the example placeholder text
    if (!privateKey || privateKey === "your_private_key_here") {
        console.warn("⚠️  WARNING: House wallet private key not configured!")
        console.warn("   Please set HOUSE_WALLET_PRIVATE_KEY in .env file")
        return null
    }

    try {
        // Try parsing as JSON array first
        if (privateKey.startsWith("[")) {
            const secretKey = new Uint8Array(JSON.parse(privateKey))
            return Keypair.fromSecretKey(secretKey)
        }

        // Try parsing as base58
        // Handle different bs58 library versions
        const decode = bs58.decode || bs58.default?.decode
        const secretKey = decode(privateKey)
        return Keypair.fromSecretKey(secretKey)
    } catch (error) {
        console.error("Failed to load house wallet:", error.message)
        return null
    }
}

houseKeypair = loadHouseWallet()

// Payout history (in production, use a database)
const payoutHistory = []
const pendingPayouts = new Map()

// ============ API Routes ============

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        houseWalletConfigured: houseKeypair !== null,
        houseWalletAddress: houseKeypair ? houseKeypair.publicKey.toBase58() : null,
        network: process.env.SOLANA_NETWORK || "devnet"
    })
})

// Get house wallet balance
app.get("/api/house/balance", async (req, res) => {
    try {
        if (!houseKeypair) {
            return res.status(503).json({ error: "House wallet not configured" })
        }

        let balance
        try {
            balance = await connection.getBalance(houseKeypair.publicKey)
        } catch (err) {
            console.warn(`Failed to fetch balance with current RPC, rotating...`)
            rotateConnection()
            balance = await connection.getBalance(houseKeypair.publicKey)
        }

        res.json({
            address: houseKeypair.publicKey.toBase58(),
            balance: balance / LAMPORTS_PER_SOL,
            lamports: balance
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Process payout
app.post("/api/payout", async (req, res) => {
    const { playerWallet, amount, gameId, blockhash, slot } = req.body

    console.log(`\n📤 Payout request received:`)
    console.log(`   Player: ${playerWallet}`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Game ID: ${gameId}`)

    // Validate request
    if (!playerWallet || !amount || !gameId) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: playerWallet, amount, gameId"
        })
    }

    if (!houseKeypair) {
        console.error("❌ House wallet not configured")
        return res.status(503).json({
            success: false,
            error: "House wallet not configured. Please set up the server."
        })
    }

    // Check for duplicate payout requests
    if (pendingPayouts.has(gameId)) {
        return res.status(409).json({
            success: false,
            error: "Payout for this game is already being processed"
        })
    }

    // Check if already paid
    const existingPayout = payoutHistory.find((p) => p.gameId === gameId)
    if (existingPayout) {
        return res.json({
            success: true,
            signature: existingPayout.signature,
            message: "Payout already processed"
        })
    }

    pendingPayouts.set(gameId, true)

    try {
        // Validate player wallet address
        const playerPubkey = new PublicKey(playerWallet)
        const lamports = Math.floor(amount * LAMPORTS_PER_SOL)

        // Check house wallet balance
        const houseBalance = await connection.getBalance(houseKeypair.publicKey)
        if (houseBalance < lamports + 5000) {
            // 5000 lamports for fees
            console.error("❌ Insufficient house wallet balance")
            pendingPayouts.delete(gameId)
            return res.status(503).json({
                success: false,
                error: "Insufficient house wallet balance"
            })
        }

        console.log(`   House balance: ${houseBalance / LAMPORTS_PER_SOL} SOL`)
        console.log(`   Sending: ${lamports} lamports`)

        // Create transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: houseKeypair.publicKey,
                toPubkey: playerPubkey,
                lamports
            })
        )

        // Get recent blockhash
        const { blockhash: recentBlockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed")

        transaction.recentBlockhash = recentBlockhash
        transaction.feePayer = houseKeypair.publicKey

        // Sign transaction
        transaction.sign(houseKeypair)

        // Send transaction
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: "confirmed"
        })

        console.log(`   ✅ Transaction sent: ${signature}`)

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(
            {
                signature,
                blockhash: recentBlockhash,
                lastValidBlockHeight
            },
            "confirmed"
        )

        if (confirmation.value.err) {
            throw new Error("Transaction failed to confirm")
        }

        console.log(`   ✅ Transaction confirmed!`)

        // Record payout
        const payoutRecord = {
            gameId,
            playerWallet,
            amount,
            signature,
            blockhash: blockhash || recentBlockhash,
            slot: slot || 0,
            timestamp: Date.now()
        }
        payoutHistory.push(payoutRecord)

        pendingPayouts.delete(gameId)

        res.json({
            success: true,
            signature,
            explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${process.env.SOLANA_NETWORK || "devnet"}`
        })
    } catch (error) {
        console.error("❌ Payout failed:", error.message)
        pendingPayouts.delete(gameId)

        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// Get payout history
app.get("/api/payouts", (req, res) => {
    res.json({
        total: payoutHistory.length,
        payouts: payoutHistory.slice(-50) // Last 50 payouts
    })
})

// ============ Start Server ============

app.listen(PORT, () => {
    console.log(`\n🎰 Coin Flip Payout Server`)
    console.log(`   Port: ${PORT}`)
    console.log(`   Network: ${process.env.SOLANA_NETWORK || "devnet"}`)

    if (houseKeypair) {
        console.log(`   House Wallet: ${houseKeypair.publicKey.toBase58()}`)
        console.log(`   ✅ Ready to process payouts!\n`)
    } else {
        console.log(`   ⚠️  House wallet NOT configured`)
        console.log(`   Please add HOUSE_WALLET_PRIVATE_KEY to .env\n`)
    }
})
