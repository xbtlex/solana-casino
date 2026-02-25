import { useState, useEffect, useRef, useCallback } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { SystemProgram, Transaction } from "@solana/web3.js"
import { getBalance, solToLamports } from "../../../utils/solana"
import { AlertCircle, Rocket } from "lucide-react"
import { GameIcon } from "../../ui/GameIcon"
import { COMMITMENT } from "../../../config/solana-config"
import { HOUSE_WALLET } from "../../../config/game-config"
import { processPayout } from "../../../utils/payoutService"
import { soundEffects } from "../../../utils/soundEffects"
import { Confetti } from "../../Confetti"

type GameState = "waiting" | "running" | "crashed"

interface GameStats {
    wins: number
    losses: number
    totalWagered: number
    totalWon: number
}

interface HistoryEntry {
    id: string
    crashPoint: number
    timestamp: number
}

const HOUSE_EDGE = 0.01
const MIN_BET = 0.001
const MAX_BET = 10
const TICK_RATE = 50 // ms between updates

export const CrashGame = () => {
    const { publicKey, sendTransaction, connected } = useWallet()
    const { connection } = useConnection()
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const [betAmount, setBetAmount] = useState("")
    const [autoCashout, setAutoCashout] = useState("")
    const [gameState, setGameState] = useState<GameState>("waiting")
    const [multiplier, setMultiplier] = useState(1.0)
    const [crashPoint, setCrashPoint] = useState<number | null>(null)
    const [balance, setBalance] = useState<number>(0)
    const [error, setError] = useState<string>("")
    const [betPlaced, setBetPlaced] = useState(false)
    const [cashedOut, setCashedOut] = useState(false)
    const [cashoutMultiplier, setCashoutMultiplier] = useState<number | null>(null)
    const [showConfetti, setShowConfetti] = useState(false)
    const [history, setHistory] = useState<HistoryEntry[]>([])
    const [multiplierHistory, setMultiplierHistory] = useState<number[]>([1])
    const [stats, setStats] = useState<GameStats>({
        wins: 0,
        losses: 0,
        totalWagered: 0,
        totalWon: 0
    })
    const [payoutPending, setPayoutPending] = useState(false)

    const gameLoopRef = useRef<NodeJS.Timeout | null>(null)
    const startTimeRef = useRef<number>(0)
    const cashedOutRef = useRef(false)
    const autoCashoutRef = useRef("")

    // Keep refs in sync with state
    useEffect(() => {
        cashedOutRef.current = cashedOut
    }, [cashedOut])

    useEffect(() => {
        autoCashoutRef.current = autoCashout
    }, [autoCashout])

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

    // Generate crash point
    const generateCrashPoint = async (): Promise<number> => {
        try {
            const { blockhash } = await connection.getLatestBlockhash(COMMITMENT)
            const seed = `${blockhash}-crash-${Date.now()}`
            const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed))
            const hashArray = new Uint8Array(hash)
            const view = new DataView(hashArray.buffer)
            const value = view.getUint32(0) / Math.pow(2, 32)

            if (value < HOUSE_EDGE) return 1.0
            const point = Math.floor((99 / (1 - value)) * 100) / 100
            return Math.max(1.0, Math.min(point, 1000))
        } catch (e) {
            console.error("Error generating crash point:", e)
            return 1.5 + Math.random() * 2 // Fallback
        }
    }

    // Draw canvas
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const width = canvas.width
        const height = canvas.height

        // Clear
        ctx.fillStyle = "rgba(16, 16, 32, 1)"
        ctx.fillRect(0, 0, width, height)

        // Grid
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)"
        ctx.lineWidth = 1
        for (let i = 0; i < 10; i++) {
            const y = (height / 10) * i
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(width, y)
            ctx.stroke()
        }

        if (multiplierHistory.length < 2) return

        // Calculate scale
        const maxMultiplier = Math.max(...multiplierHistory, 2)
        const scaleY = (height - 60) / (maxMultiplier - 1)
        const scaleX = (width - 40) / Math.max(multiplierHistory.length - 1, 1)

        // Draw curve
        ctx.beginPath()
        ctx.strokeStyle = gameState === "crashed" ? "#ef4444" : "#22c55e"
        ctx.lineWidth = 3
        ctx.shadowColor = gameState === "crashed" ? "#ef4444" : "#22c55e"
        ctx.shadowBlur = 10

        multiplierHistory.forEach((m, i) => {
            const x = 20 + i * scaleX
            const y = height - 20 - (m - 1) * scaleY
            if (i === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
        })
        ctx.stroke()

        // Fill under curve
        ctx.lineTo(20 + (multiplierHistory.length - 1) * scaleX, height - 20)
        ctx.lineTo(20, height - 20)
        ctx.closePath()
        const fillGradient = ctx.createLinearGradient(0, 0, 0, height)
        fillGradient.addColorStop(0, gameState === "crashed" ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)")
        fillGradient.addColorStop(1, "rgba(0, 0, 0, 0)")
        ctx.fillStyle = fillGradient
        ctx.fill()

        ctx.shadowBlur = 0
    }, [multiplierHistory, gameState])

    useEffect(() => {
        drawCanvas()
    }, [drawCanvas])

    const startRunLoop = (point: number, amount: number) => {
        // Reset refs at start
        cashedOutRef.current = false
        setCashedOut(false)

        setGameState("running")
        setMultiplier(1.0)
        setMultiplierHistory([1])
        startTimeRef.current = Date.now()

        // Track simulated elapsed time (for speeding up after cashout)
        let simulatedElapsed = 0
        let lastTickTime = Date.now()
        let speedMultiplier = 1

        const tick = () => {
            const now = Date.now()
            const realDelta = (now - lastTickTime) / 1000
            lastTickTime = now

            // After cashout, speed up time 8x to quickly show crash point
            if (cashedOutRef.current) {
                speedMultiplier = 8
            }

            simulatedElapsed += realDelta * speedMultiplier
            const newMultiplier = Math.pow(Math.E, 0.06 * simulatedElapsed)
            const roundedMultiplier = Math.floor(newMultiplier * 100) / 100

            if (roundedMultiplier >= point) {
                setMultiplier(point)
                setMultiplierHistory((prev) => [...prev, point])
                setGameState("crashed")

                setHistory((prev) =>
                    [{ id: `crash_${Date.now()}`, crashPoint: point, timestamp: Date.now() }, ...prev].slice(0, 20)
                )

                // Check if user crashed (didn't cash out) - use ref for current value
                if (!cashedOutRef.current) {
                    soundEffects.playLose()
                    setStats((prev) => ({
                        ...prev,
                        losses: prev.losses + 1,
                        totalWagered: prev.totalWagered + amount
                    }))
                }

                setTimeout(() => {
                    setBetPlaced(false)
                    setCashedOut(false)
                    cashedOutRef.current = false
                    setCashoutMultiplier(null)
                    setGameState("waiting")
                    setMultiplier(1.0)
                    setMultiplierHistory([1])
                }, 3000)
                return
            }

            setMultiplier(roundedMultiplier)
            setMultiplierHistory((prev) => [...prev, roundedMultiplier])

            // Auto-cashout logic - use ref for current value
            const autoVal = parseFloat(autoCashoutRef.current)
            if (!cashedOutRef.current && !isNaN(autoVal) && autoVal > 1.0 && roundedMultiplier >= autoVal) {
                handleCashoutLogic(roundedMultiplier, amount)
            }

            // Use faster tick rate after cashout for smoother fast-forward
            const tickRate = cashedOutRef.current ? 15 : TICK_RATE
            gameLoopRef.current = setTimeout(tick, tickRate)
        }

        tick()
    }

    const handleCashoutLogic = async (multiplierAtCashout: number, amount: number) => {
        // Check ref to prevent double cashout
        if (cashedOutRef.current) return

        // Immediately mark as cashed out via ref to prevent race conditions
        cashedOutRef.current = true
        setCashedOut(true)

        setCashoutMultiplier(multiplierAtCashout)
        soundEffects.playWin()
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 4000)

        const winnings = amount * multiplierAtCashout
        setStats((prev) => ({
            ...prev,
            wins: prev.wins + 1,
            totalWagered: prev.totalWagered + amount,
            totalWon: prev.totalWon + winnings
        }))

        // Process payout to player
        if (publicKey) {
            setPayoutPending(true)
            try {
                const gameId = `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                const result = await processPayout(connection, {
                    playerWallet: publicKey.toBase58(),
                    amount: winnings,
                    gameId,
                    blockhash: "",
                    slot: 0
                })

                if (result.success) {
                    console.log(`Payout successful: ${result.signature}`)
                } else {
                    console.error(`Payout failed: ${result.error}`)
                    setError(`Payout pending: ${result.error}. Contact support.`)
                }
            } catch (err: any) {
                console.error("Payout error:", err)
                setError(`Payout error: ${err.message}. Contact support.`)
            } finally {
                setPayoutPending(false)
            }
        }
    }

    const placeBet = async () => {
        setError("")
        if (!betAmount.trim()) {
            setError("Please enter a bet amount")
            return
        }

        const amount = parseFloat(betAmount)
        if (isNaN(amount) || amount < MIN_BET || amount > MAX_BET) {
            setError(`Bet must be between ${MIN_BET} and ${MAX_BET} SOL`)
            return
        }

        if (amount > balance) {
            setError("Insufficient balance")
            return
        }

        if (!publicKey) return

        try {
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

            setBetPlaced(true)
            soundEffects.playClick()

            // Generate crash point and start loop immediately
            const point = await generateCrashPoint()
            setCrashPoint(point)
            startRunLoop(point, amount)
        } catch (err: any) {
            console.error("Bet error:", err)
            setError(err.message?.includes("User rejected") ? "Transaction cancelled" : "Failed to place bet")
        }
    }

    const handleManualCashout = () => {
        if (!betPlaced || cashedOut || gameState !== "running") return
        handleCashoutLogic(multiplier, parseFloat(betAmount))
    }

    // Resize canvas
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const resize = () => {
            const rect = canvas.parentElement?.getBoundingClientRect()
            if (rect) {
                canvas.width = rect.width
                canvas.height = 300
            }
        }
        resize()
        window.addEventListener("resize", resize)
        return () => window.removeEventListener("resize", resize)
    }, [])

    if (!connected) {
        return (
            <div className='glass-card p-8 text-center'>
                <TrendingUp className='w-12 h-12 mx-auto mb-4 text-muted-foreground' />
                <p className='text-muted-foreground'>Connect your wallet to play Crash</p>
            </div>
        )
    }

    return (
        <>
            <Confetti active={showConfetti} />

            <div className='max-w-4xl mx-auto space-y-6'>
                <div className='text-center'>
                    <div className='flex items-center justify-center gap-3 mb-2'>
                        <GameIcon game="crash" size="lg" showGlow={true} />
                        <h1 className='text-4xl font-bold text-white'>Crash</h1>
                    </div>
                    <p className='text-muted-foreground'>Manual Start • Zero Wait • Instant Sell</p>
                </div>

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
                    <div className='lg:col-span-2 glass-card p-6 flex flex-col'>
                        <div className='text-center mb-6 h-32 flex flex-col items-center justify-center'>
                            {gameState === "crashed" ? (
                                <div className='animate-in zoom-in duration-300'>
                                    <div className='text-6xl font-bold text-red-400'>{crashPoint?.toFixed(2)}x</div>
                                    <p className='text-red-400 font-bold tracking-widest'>CRASHED</p>
                                </div>
                            ) : cashedOut && cashoutMultiplier ? (
                                <div className='animate-in zoom-in duration-300'>
                                    <div className='text-6xl font-bold text-green-400'>
                                        {cashoutMultiplier.toFixed(2)}x
                                    </div>
                                    <p className='text-green-400 font-bold tracking-widest'>GOLDEN SELL!</p>
                                    {payoutPending && (
                                        <p className='text-yellow-400 text-sm mt-2 animate-pulse'>Processing payout...</p>
                                    )}
                                </div>
                            ) : (
                                <div
                                    className={`text-7xl font-bold transition-all duration-75 ${
                                        gameState === "running"
                                            ? multiplier >= 2
                                                ? "text-green-400 scale-110"
                                                : "text-white"
                                            : "text-white/20"
                                    }`}
                                >
                                    {multiplier.toFixed(2)}x
                                </div>
                            )}
                        </div>

                        <div className='relative rounded-xl overflow-hidden border border-white/10 bg-black/20'>
                            <canvas ref={canvasRef} className='w-full' style={{ height: "300px" }} />
                        </div>
                    </div>

                    <div className='space-y-6'>
                        <div className='glass-card p-6 space-y-4'>
                            <div className='flex items-center justify-between'>
                                <span className='text-sm text-muted-foreground'>Bet Amount</span>
                                <span className='text-sm font-mono text-primary'>SOL: {balance.toFixed(4)}</span>
                            </div>

                            <div className='relative'>
                                <input
                                    type='number'
                                    value={betAmount}
                                    onChange={(e) => setBetAmount(e.target.value)}
                                    placeholder='0.00'
                                    disabled={betPlaced}
                                    className='w-full bg-white/10 border-2 border-white/10 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all font-mono text-xl'
                                />
                                <div className='absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold'>
                                    SOL
                                </div>
                            </div>

                            <div className='grid grid-cols-4 gap-2'>
                                {[0.01, 0.1, 0.5, 1].map((amt) => (
                                    <button
                                        key={amt}
                                        onClick={() => setBetAmount(amt.toString())}
                                        disabled={betPlaced}
                                        className='px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-primary/20 transition-all'
                                    >
                                        {amt}
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className='text-sm text-muted-foreground mb-2 block'>Auto Sell At (x)</label>
                                <input
                                    type='number'
                                    value={autoCashout}
                                    onChange={(e) => setAutoCashout(e.target.value)}
                                    placeholder='2.00'
                                    disabled={betPlaced}
                                    className='w-full bg-white/10 border-2 border-white/10 rounded-xl px-4 py-3 text-white font-mono'
                                />
                            </div>

                            {error && (
                                <div className='flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm'>
                                    <AlertCircle className='w-4 h-4' /> {error}
                                </div>
                            )}

                            {gameState === "waiting" && !betPlaced ? (
                                <button
                                    onClick={placeBet}
                                    className='w-full bg-gradient-to-r from-[#7fffd4] to-[#5cccaa] hover:shadow-[0_0_40px_rgba(127,255,212,0.6)] transition-all px-6 py-4 rounded-xl font-bold text-[#0a1f1c] text-lg flex items-center justify-center gap-2 group'
                                >
                                    <Rocket className='w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform' />
                                    Launch Game
                                </button>
                            ) : gameState === "running" && !cashedOut ? (
                                <button
                                    onClick={handleManualCashout}
                                    className='w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-[0_0_40px_rgba(34,197,94,0.6)] px-6 py-4 rounded-xl font-bold text-white text-lg animate-pulse'
                                >
                                    Sell / Cash Out {(parseFloat(betAmount) * multiplier).toFixed(4)} SOL
                                </button>
                            ) : (
                                <div className='p-4 bg-white/5 rounded-xl text-center text-muted-foreground border border-white/5 italic'>
                                    {gameState === "crashed" ? "Game Over - Resetting..." : "Game Active..."}
                                </div>
                            )}

                            <p className='text-[10px] text-center text-muted-foreground uppercase tracking-widest'>
                                Provably Fair • 1% Edge
                            </p>
                        </div>

                        {history.length > 0 && (
                            <div className='glass-card p-4'>
                                <h4 className='text-sm font-bold text-white mb-3 flex items-center gap-2'>
                                    <TrendingUp className='w-4 h-4' /> Recent Multipliers
                                </h4>
                                <div className='flex flex-wrap gap-2'>
                                    {history.slice(0, 8).map((entry) => (
                                        <div
                                            key={entry.id}
                                            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold ${
                                                entry.crashPoint >= 2
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-red-500/20 text-red-400"
                                            }`}
                                        >
                                            {entry.crashPoint.toFixed(2)}x
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
