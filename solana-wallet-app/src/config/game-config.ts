import { PublicKey } from "@solana/web3.js"

// House wallet address - receives losing bets
export const HOUSE_WALLET_ADDRESS = "2Lohfz4wUTRGmr7cBGU12sd1TNZHBMLL4N9BMvBnoFaC"

// IMPORTANT: This wallet needs to have SOL to pay out winners
// In production, this should be a program-derived address (PDA) from a Solana program

export const HOUSE_WALLET = new PublicKey(HOUSE_WALLET_ADDRESS)

// Game modes with different multipliers
export interface GameMode {
    id: string
    name: string
    multiplier: number
    winChance: number // percentage
    description: string
    minBet: number
    maxBet: number
    color: string
}

export const GAME_MODES: GameMode[] = [
    {
        id: "safe",
        name: "Safe",
        multiplier: 1.5,
        winChance: 50,
        description: "Lower risk, steady gains",
        minBet: 0.001,
        maxBet: 20,
        color: "green"
    },
    {
        id: "classic",
        name: "Classic",
        multiplier: 2,
        winChance: 50,
        description: "Double or nothing!",
        minBet: 0.001,
        maxBet: 10,
        color: "primary"
    },
    {
        id: "risky",
        name: "Risky",
        multiplier: 3,
        winChance: 33,
        description: "High risk, high reward",
        minBet: 0.001,
        maxBet: 5,
        color: "orange"
    },
    {
        id: "extreme",
        name: "Extreme",
        multiplier: 5,
        winChance: 20,
        description: "Maximum thrill!",
        minBet: 0.001,
        maxBet: 2,
        color: "red"
    }
]

export const DEFAULT_GAME_MODE = GAME_MODES[1] // Classic mode

// Game configuration
export const GAME_CONFIG = {
    minBet: 0.001, // 0.001 SOL minimum bet
    maxBet: 10, // 10 SOL maximum bet
    winMultiplier: 2, // 2x payout on win
    houseEdge: 0 // 0% house edge (50/50 fair game)
}

// Payout configuration
export const PAYOUT_CONFIG = {
    // Set to true to enable automatic payouts (requires backend)
    autoPayouts: true,

    // Manual payout instructions
    manualPayoutInstructions: `
To manually send payouts:
1. Check pending payouts in the app
2. Use Phantom/Solflare to send SOL to winner's address
3. Mark payout as complete
  `.trim()
}
