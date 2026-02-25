import { useState, useEffect, useRef } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { SystemProgram, Transaction } from "@solana/web3.js"
import { getBalance, solToLamports } from "../../../utils/solana"
import { Loader2, AlertCircle, Trophy, Star } from "lucide-react"
import { GameIcon } from "../../ui/GameIcon"
import { COMMITMENT } from "../../../config/solana-config"
import { HOUSE_WALLET } from "../../../config/game-config"
import { processPayout } from "../../../utils/payoutService"
import { soundEffects } from "../../../utils/soundEffects"
import { Confetti } from "../../Confetti"

type GamePhase = "betting" | "sending" | "spinning" | "result"

interface GameStats {
    wins: number
    losses: number
    totalWagered: number
    totalWon: number
    jackpotsWon: number
}

// Symbols and their weights (lower = rarer)
const SYMBOLS = ["7️⃣", "💎", "🍀", "🔔", "⭐", "🍒", "🍋"] as const
type Symbol = (typeof SYMBOLS)[number]

const WEIGHTS: Record<Symbol, number> = {
    "7️⃣": 1, // Jackpot - very rare
    "💎": 3, // 500x
    "🍀": 8, // 100x
    "🔔": 15, // 50x
    "⭐": 25, // 25x
    "🍒": 30, // 10x
    "🍋": 40 // 5x
}

const PAYOUTS: Record<Symbol, { three: number | "JACKPOT"; two: number }> = {
    "7️⃣": { three: "JACKPOT", two: 50 },
    "💎": { three: 500, two: 25 },
    "🍀": { three: 100, two: 10 },
    "🔔": { three: 50, two: 5 },
    "⭐": { three: 25, two: 3 },
    "🍒": { three: 10, two: 2 },
    "🍋": { three: 5, two: 2 }
}

const MIN_BET = 0.001
const MAX_BET = 5
const INITIAL_JACKPOT = 5000 // 5000 SOL equivalent display
const JACKPOT_CONTRIBUTION = 0.02 // 2% of each bet

export const SlotsGame = () => {
    const { publicKey, sendTransaction, connected } = useWallet()
    const { connection } = useConnection()

    const [betAmount, setBetAmount] = useState("")
    const [gamePhase, setGamePhase] = useState<GamePhase>("betting")
    const [reels, setReels] = useState<Symbol[]>(["🍋", "🍋", "🍋"])
    const [spinningReels, setSpinningReels] = useState<number[]>([])
    const [displayReels, setDisplayReels] = useState<Symbol[][]>([[...SYMBOLS], [...SYMBOLS], [...SYMBOLS]])
    const [balance, setBalance] = useState<number>(0)
    const [error, setError] = useState<string>("")
    const [jackpot, setJackpot] = useState<number>(() => {
        const stored = localStorage.getItem("slots_jackpot")
        return stored ? parseFloat(stored) : INITIAL_JACKPOT
    })
    const [winAmount, setWinAmount] = useState<number | null>(null)
    const [winType, setWinType] = useState<string>("")
    const [showConfetti, setShowConfetti] = useState(false)
    const [stats, setStats] = useState<GameStats>({
        wins: 0,
        losses: 0,
        totalWagered: 0,
        totalWon: 0,
        jackpotsWon: 0
    })

    const spinIntervals = useRef<NodeJS.Timeout[]>([])

    // Save jackpot to localStorage
    useEffect(() => {
        localStorage.setItem("slots_jackpot", jackpot.toString())
    }, [jackpot])

    // Fetch balance
    useEffect(() => {
        if (!publicKey || !connected) {
            setBalance(0)
            return
        }

        const fetchBalance = async () => {
            try {
                const bal = await getBalance(connection, publicKey)
                setBalance(bal)
            } catch (error) {
                console.error("Failed to fetch balance:", error)
            }
        }

        fetchBalance()
        const interval = setInterval(fetchBalance, 5000)
        return () => clearInterval(interval)
    }, [publicKey, connected, connection])

    // Weighted random symbol selection
    const getRandomSymbol = (): Symbol => {
        const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
        let random = Math.random() * totalWeight

        for (const [symbol, weight] of Object.entries(WEIGHTS)) {
            random -= weight
            if (random <= 0) return symbol as Symbol
        }

        return "🍋"
    }

    // Calculate win
    const calculateWin = (symbols: Symbol[], betAmt: number): { amount: number; type: string } => {
        const [s1, s2, s3] = symbols

        // Three of a kind
        if (s1 === s2 && s2 === s3) {
            const payout = PAYOUTS[s1].three
            if (payout === "JACKPOT") {
                return { amount: jackpot, type: "JACKPOT! 🎰" }
            }
            return { amount: betAmt * payout, type: `Three ${s1} - ${payout}x` }
        }

        // Two of a kind (first two)
        if (s1 === s2) {
            const payout = PAYOUTS[s1].two
            return { amount: betAmt * payout, type: `Two ${s1} - ${payout}x` }
        }

        // Two of a kind (last two)
        if (s2 === s3) {
            const payout = PAYOUTS[s2].two
            return { amount: betAmt * payout, type: `Two ${s2} - ${payout}x` }
        }

        // Two of a kind (first and last)
        if (s1 === s3) {
            const payout = PAYOUTS[s1].two
            return { amount: betAmt * payout, type: `Two ${s1} - ${payout}x` }
        }

        return { amount: 0, type: "" }
    }

    const spin = async () => {
        setError("")
        setWinAmount(null)
        setWinType("")

        if (!betAmount.trim()) {
            setError("Please enter a bet amount")
            return
        }

        const amount = parseFloat(betAmount)

        if (isNaN(amount) || amount < MIN_BET) {
            setError(`Minimum bet is ${MIN_BET} SOL`)
            return
        }

        if (amount > MAX_BET) {
            setError(`Maximum bet is ${MAX_BET} SOL`)
            return
        }

        if (amount > balance) {
            setError("Insufficient balance")
            return
        }

        if (!publicKey) return

        setGamePhase("sending")

        try {
            // Send bet to house
            const betTransaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: HOUSE_WALLET,
                    lamports: solToLamports(amount)
                })
            )

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(COMMITMENT)
            betTransaction.recentBlockhash = blockhash
            betTransaction.feePayer = publicKey

            const signature = await sendTransaction(betTransaction, connection)
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, COMMITMENT)

            // Add to jackpot
            setJackpot((prev) => prev + amount * JACKPOT_CONTRIBUTION)

            // Start spinning
            setGamePhase("spinning")
            soundEffects.playFlip()

            // Generate final results
            const finalReels: Symbol[] = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]

            // Start all reels spinning
            setSpinningReels([0, 1, 2])

            // Animate each reel
            spinIntervals.current.forEach(clearInterval)
            spinIntervals.current = []

            const reelDelays = [0, 500, 1000] // Stagger stops
            const spinDuration = 2000

            reelDelays.forEach((delay, reelIndex) => {
                // Rapid cycling animation
                const interval = setInterval(() => {
                    setDisplayReels((prev) => {
                        const newReels = [...prev]
                        newReels[reelIndex] = [...SYMBOLS].sort(() => Math.random() - 0.5)
                        return newReels
                    })
                }, 50)

                spinIntervals.current.push(interval)

                // Stop this reel
                setTimeout(() => {
                    clearInterval(interval)
                    setSpinningReels((prev) => prev.filter((r) => r !== reelIndex))
                    setReels((prev) => {
                        const newReels = [...prev]
                        newReels[reelIndex] = finalReels[reelIndex]
                        return newReels
                    })

                    // Play stop sound
                    soundEffects.playClick()

                    // All reels stopped
                    if (reelIndex === 2) {
                        setTimeout(() => {
                            const result = calculateWin(finalReels, amount)
                            setGamePhase("result")

                            if (result.amount > 0) {
                                setWinAmount(result.amount)
                                setWinType(result.type)
                                soundEffects.playWin()
                                setShowConfetti(true)
                                setTimeout(() => setShowConfetti(false), 4000)

                                // Handle jackpot
                                if (result.type.includes("JACKPOT")) {
                                    setJackpot(INITIAL_JACKPOT)
                                    setStats((prev) => ({
                                        ...prev,
                                        jackpotsWon: prev.jackpotsWon + 1
                                    }))
                                }

                                // Process payout
                                processPayout(connection, {
                                    playerWallet: publicKey.toBase58(),
                                    amount: result.amount,
                                    gameId: `slots_${Date.now()}`,
                                    blockhash: "",
                                    slot: 0
                                }).catch(console.error)

                                setStats((prev) => ({
                                    ...prev,
                                    wins: prev.wins + 1,
                                    totalWagered: prev.totalWagered + amount,
                                    totalWon: prev.totalWon + result.amount
                                }))
                            } else {
                                soundEffects.playLose()
                                setStats((prev) => ({
                                    ...prev,
                                    losses: prev.losses + 1,
                                    totalWagered: prev.totalWagered + amount
                                }))
                            }
                        }, 500)
                    }
                }, spinDuration + delay)
            })
        } catch (err: any) {
            if (err.message?.includes("User rejected")) {
                setError("Transaction cancelled")
            } else {
                setError("Failed to place bet")
            }
            setGamePhase("betting")
        }
    }

    const resetGame = () => {
        setWinAmount(null)
        setWinType("")
        setGamePhase("betting")
    }

    const isSpinning = gamePhase === "spinning" || gamePhase === "sending"

    if (!connected) {
        return (
            <div className='glass-card p-8 text-center'>
                <Cherry className='w-12 h-12 mx-auto mb-4 text-muted-foreground' />
                <p className='text-muted-foreground'>Connect your wallet to play Slots</p>
            </div>
        )
    }

    return (
        <>
            <Confetti active={showConfetti} />

            <div className='max-w-4xl mx-auto space-y-6'>
                {/* Header */}
                <div className='text-center'>
                    <div className='flex items-center justify-center gap-3 mb-2'>
                        <GameIcon game="slots" size="lg" showGlow={true} />
                        <h1 className='text-4xl font-bold text-white'>Slots</h1>
                    </div>
                    <p className='text-muted-foreground'>Match symbols to win big!</p>
                </div>

                {/* Jackpot Display */}
                <div className='glass-card p-6 text-center bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/30'>
                    <div className='flex items-center justify-center gap-2 mb-2'>
                        <Star className='w-6 h-6 text-emerald-400' />
                        <span className='text-lg font-bold text-emerald-400'>JACKPOT</span>
                        <Star className='w-6 h-6 text-emerald-400' />
                    </div>
                    <div className='text-4xl font-bold text-white'>{jackpot.toFixed(2)} SOL</div>
                    <p className='text-xs text-emerald-400/60 mt-2'>Hit 7️⃣ 7️⃣ 7️⃣ to win!</p>
                </div>

                {/* Stats */}
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                    <div className='glass-card p-4'>
                        <div className='text-xs text-muted-foreground mb-1'>Wins</div>
                        <div className='text-2xl font-bold text-green-400'>{stats.wins}</div>
                    </div>
                    <div className='glass-card p-4'>
                        <div className='text-xs text-muted-foreground mb-1'>Losses</div>
                        <div className='text-2xl font-bold text-red-400'>{stats.losses}</div>
                    </div>
                    <div className='glass-card p-4'>
                        <div className='text-xs text-muted-foreground mb-1'>Wagered</div>
                        <div className='text-2xl font-bold text-white'>{stats.totalWagered.toFixed(2)}</div>
                    </div>
                    <div className='glass-card p-4'>
                        <div className='text-xs text-muted-foreground mb-1'>Won</div>
                        <div className='text-2xl font-bold text-primary'>{stats.totalWon.toFixed(2)}</div>
                    </div>
                </div>

                <div className='grid lg:grid-cols-3 gap-6'>
                    {/* Slot Machine */}
                    <div className='lg:col-span-2 glass-card p-8'>
                        {/* Reels */}
                        <div className='flex justify-center gap-4 mb-8'>
                            {[0, 1, 2].map((reelIndex) => (
                                <div
                                    key={reelIndex}
                                    className={`w-28 h-32 bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl border-4 ${
                                        winAmount && winAmount > 0 ? "border-emerald-400" : "border-gray-700"
                                    } flex items-center justify-center overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]`}
                                >
                                    <div
                                        className={`text-6xl ${
                                            spinningReels.includes(reelIndex) ? "animate-bounce" : ""
                                        }`}
                                    >
                                        {spinningReels.includes(reelIndex)
                                            ? displayReels[reelIndex][0]
                                            : reels[reelIndex]}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Win Display */}
                        {winAmount !== null && gamePhase === "result" && (
                            <div
                                className={`p-6 rounded-xl text-center mb-6 ${
                                    winAmount > 0
                                        ? "bg-green-500/20 border-2 border-green-500/40"
                                        : "bg-red-500/20 border-2 border-red-500/40"
                                }`}
                            >
                                {winAmount > 0 ? (
                                    <>
                                        <Trophy className='w-12 h-12 mx-auto mb-2 text-emerald-400' />
                                        <div className='text-2xl font-bold text-green-400 mb-2'>
                                            +{winAmount.toFixed(4)} SOL
                                        </div>
                                        <p className='text-white'>{winType}</p>
                                    </>
                                ) : (
                                    <>
                                        <div className='text-2xl font-bold text-red-400 mb-2'>No Win</div>
                                        <p className='text-muted-foreground'>Try again!</p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Paytable */}
                        <div className='grid grid-cols-2 md:grid-cols-4 gap-2 text-sm'>
                            {Object.entries(PAYOUTS).map(([symbol, payout]) => (
                                <div key={symbol} className='bg-white/5 rounded-lg p-2 text-center'>
                                    <div className='text-2xl'>
                                        {symbol}
                                        {symbol}
                                        {symbol}
                                    </div>
                                    <div className='text-primary font-bold'>
                                        {payout.three === "JACKPOT" ? "JACKPOT" : `${payout.three}x`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Betting Panel */}
                    <div className='glass-card p-6 space-y-4'>
                        <div className='flex items-center justify-between'>
                            <span className='text-sm text-muted-foreground'>Bet Amount</span>
                            <span className='text-sm font-mono text-primary'>Balance: {balance.toFixed(4)} SOL</span>
                        </div>

                        {/* Bet Input */}
                        <div className='relative'>
                            <input
                                type='number'
                                value={betAmount}
                                onChange={(e) => setBetAmount(e.target.value)}
                                placeholder='0.00'
                                disabled={isSpinning}
                                step='0.001'
                                className='w-full bg-white/10 border-2 border-white/10 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all font-mono text-xl pr-16'
                            />
                            <div className='absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold'>
                                SOL
                            </div>
                        </div>

                        {/* Quick Amounts */}
                        <div className='grid grid-cols-4 gap-2'>
                            {[0.01, 0.1, 0.5, 1].map((amount) => (
                                <button
                                    key={amount}
                                    onClick={() => setBetAmount(amount.toString())}
                                    disabled={isSpinning}
                                    className='px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-primary/20 hover:border-primary/50 transition-all disabled:opacity-50'
                                >
                                    {amount}
                                </button>
                            ))}
                        </div>

                        {/* Error */}
                        {error && (
                            <div className='flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400'>
                                <AlertCircle className='w-4 h-4' />
                                <span className='text-sm'>{error}</span>
                            </div>
                        )}

                        {/* Spin Button */}
                        {gamePhase === "result" ? (
                            <button
                                onClick={resetGame}
                                className='w-full bg-gradient-to-r from-[#7fffd4] to-[#5cccaa] hover:shadow-[0_0_40px_rgba(127,255,212,0.6)] transition-all duration-300 px-6 py-4 rounded-full font-bold text-[#0a1f1c] text-lg'
                            >
                                Spin Again
                            </button>
                        ) : (
                            <button
                                onClick={spin}
                                disabled={isSpinning}
                                className='w-full bg-gradient-to-r from-red-500 to-rose-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] transition-all duration-300 px-6 py-4 rounded-xl font-bold text-white text-lg disabled:opacity-50 relative overflow-hidden group'
                            >
                                <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700' />
                                <span className='relative flex items-center justify-center gap-2'>
                                    {isSpinning ? (
                                        <>
                                            <Loader2 className='w-5 h-5 animate-spin' />
                                            Spinning...
                                        </>
                                    ) : (
                                        <>
                                            <Cherry className='w-5 h-5' />
                                            SPIN
                                        </>
                                    )}
                                </span>
                            </button>
                        )}

                        <p className='text-xs text-center text-muted-foreground'>House Edge: 2% • 2% goes to Jackpot</p>
                    </div>
                </div>
            </div>
        </>
    )
}
