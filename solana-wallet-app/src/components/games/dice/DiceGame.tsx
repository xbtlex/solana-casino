import { useState, useEffect } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { SystemProgram, Transaction } from "@solana/web3.js"
import { getBalance, solToLamports, getExplorerUrl } from "../../../utils/solana"
import { validateAmount, validateBalance } from "../../../utils/validation"
import {
    Loader2,
    AlertCircle,
    Trophy,
    TrendingDown,
    ExternalLink,
    Hash,
    Clock,
    ArrowUp,
    ArrowDown
} from "lucide-react"
import { COMMITMENT, SOLANA_NETWORK } from "../../../config/solana-config"
import { HOUSE_WALLET } from "../../../config/game-config"
import { GameIcon } from "../../ui/GameIcon"
import { generateProvablyFairResult } from "../../../utils/provablyFair"
import { processPayout } from "../../../utils/payoutService"
import { soundEffects } from "../../../utils/soundEffects"
import { Confetti } from "../../Confetti"
import { motion, AnimatePresence } from "framer-motion"

type GamePhase = "betting" | "sending" | "rolling" | "payout" | "result"

interface GameStats {
    wins: number
    losses: number
    totalWagered: number
    totalWon: number
}

interface HistoryEntry {
    id: string
    timestamp: number
    betAmount: number
    target: number
    rollOver: boolean
    result: number
    won: boolean
    payout: number
    multiplier: number
}

const HOUSE_EDGE = 0.01 // 1% house edge
const MIN_BET = 0.001
const MAX_BET = 10

export const DiceGame = () => {
    const { publicKey, sendTransaction, connected } = useWallet()
    const { connection } = useConnection()

    const [betAmount, setBetAmount] = useState("")
    const [target, setTarget] = useState(50)
    const [rollOver, setRollOver] = useState(true) // true = roll over, false = roll under
    const [gamePhase, setGamePhase] = useState<GamePhase>("betting")
    const [diceResult, setDiceResult] = useState<number | null>(null)
    const [gameResult, setGameResult] = useState<"win" | "lose" | null>(null)
    const [balance, setBalance] = useState<number>(0)
    const [error, setError] = useState<string>("")
    const [txSignature, setTxSignature] = useState<string | null>(null)
    const [provablyFairData, setProvablyFairData] = useState<{ blockhash: string; slot: number } | null>(null)
    const [showConfetti, setShowConfetti] = useState(false)
    const [rollingNumber, setRollingNumber] = useState(50)
    const [history, setHistory] = useState<HistoryEntry[]>([])
    const [stats, setStats] = useState<GameStats>({
        wins: 0,
        losses: 0,
        totalWagered: 0,
        totalWon: 0
    })

    // Calculate win chance and multiplier
    const winChance = rollOver ? 100 - target : target
    const multiplier = ((1 - HOUSE_EDGE) * 100) / winChance

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
    }, [publicKey, connected, connection, gameResult])

    const validateBet = (): boolean => {
        setError("")

        if (!betAmount.trim()) {
            setError("Please enter a bet amount")
            return false
        }

        if (!validateAmount(betAmount)) {
            setError("Invalid bet amount")
            return false
        }

        const amount = parseFloat(betAmount)

        if (amount < MIN_BET) {
            setError(`Minimum bet is ${MIN_BET} SOL`)
            return false
        }

        if (amount > MAX_BET) {
            setError(`Maximum bet is ${MAX_BET} SOL`)
            return false
        }

        const balanceCheck = validateBalance(amount, balance)
        if (!balanceCheck.valid) {
            setError(balanceCheck.error || "Insufficient balance")
            return false
        }

        return true
    }

    const rollDice = async () => {
        if (!validateBet() || !connected || !publicKey) return

        setGamePhase("sending")
        setGameResult(null)
        setDiceResult(null)
        setError("")
        setTxSignature(null)
        setProvablyFairData(null)

        const amount = parseFloat(betAmount)

        try {
            // STEP 1: Send bet to house wallet
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

            const betSignature = await sendTransaction(betTransaction, connection)
            setTxSignature(betSignature)

            const confirmation = await connection.confirmTransaction(
                { signature: betSignature, blockhash, lastValidBlockHeight },
                COMMITMENT
            )

            if (confirmation.value.err) {
                throw new Error("Bet transaction failed")
            }

            // STEP 2: Roll the dice
            setGamePhase("rolling")
            soundEffects.playFlip()

            // Generate provably fair result (1-100)
            const fairResult = await generateProvablyFairResult(connection, winChance, publicKey.toBase58())

            // Convert the won/lost to a dice number (1-100)
            // Using the hash to get a number between 1-100
            const seed = `${fairResult.blockhash}-${fairResult.slot}-${publicKey.toBase58()}-dice`
            const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed))
            const hashArray = new Uint8Array(hash)
            const rollResult = Math.floor((hashArray[0] / 255) * 99) + 1 // 1-100

            // Animate the rolling
            const animationDuration = 2000
            const animationStart = Date.now()

            const animateRoll = () => {
                const elapsed = Date.now() - animationStart
                if (elapsed < animationDuration) {
                    setRollingNumber(Math.floor(Math.random() * 100) + 1)
                    requestAnimationFrame(animateRoll)
                } else {
                    setRollingNumber(rollResult)
                    setDiceResult(rollResult)
                }
            }
            animateRoll()

            await new Promise((resolve) => setTimeout(resolve, animationDuration))

            setProvablyFairData({
                blockhash: fairResult.blockhash,
                slot: fairResult.slot
            })

            // Determine win/loss
            const didWin = rollOver ? rollResult > target : rollResult < target
            setGameResult(didWin ? "win" : "lose")
            setGamePhase("result")

            if (didWin) {
                soundEffects.playWin()
                setShowConfetti(true)
                setTimeout(() => setShowConfetti(false), 4000)

                // Process payout
                setGamePhase("payout")
                const payoutAmount = amount * multiplier

                try {
                    await processPayout(connection, {
                        playerWallet: publicKey.toBase58(),
                        amount: payoutAmount,
                        gameId: `dice_${Date.now()}`,
                        blockhash: fairResult.blockhash,
                        slot: fairResult.slot
                    })
                } catch (payoutError) {
                    console.error("Payout error:", payoutError)
                }

                setGamePhase("result")
            } else {
                soundEffects.playLose()
            }

            // Update stats
            setStats((prev) => ({
                wins: prev.wins + (didWin ? 1 : 0),
                losses: prev.losses + (didWin ? 0 : 1),
                totalWagered: prev.totalWagered + amount,
                totalWon: prev.totalWon + (didWin ? amount * multiplier : 0)
            }))

            // Add to history
            setHistory((prev) =>
                [
                    {
                        id: `dice_${Date.now()}`,
                        timestamp: Date.now(),
                        betAmount: amount,
                        target,
                        rollOver,
                        result: rollResult,
                        won: didWin,
                        payout: didWin ? amount * multiplier : 0,
                        multiplier
                    },
                    ...prev
                ].slice(0, 50)
            )
        } catch (err: any) {
            console.error("Game error:", err)
            if (err.message?.includes("User rejected")) {
                setError("Transaction cancelled by user")
            } else if (err.message?.includes("insufficient")) {
                setError("Insufficient SOL balance")
            } else {
                setError("Failed to process bet. Please try again.")
            }
            setGamePhase("betting")
        }
    }

    const resetGame = () => {
        setDiceResult(null)
        setGameResult(null)
        setError("")
        setTxSignature(null)
        setProvablyFairData(null)
        setGamePhase("betting")
    }

    const isProcessing = gamePhase === "sending" || gamePhase === "rolling" || gamePhase === "payout"
    const potentialWin = parseFloat(betAmount || "0") * multiplier

    if (!connected) {
        return (
            <div className='glass-card p-8 text-center'>
                <Dices className='w-12 h-12 mx-auto mb-4 text-muted-foreground' />
                <p className='text-muted-foreground'>Connect your wallet to play Dice</p>
            </div>
        )
    }

    // Generate sparkline data from history
    const sparklineData = history
        .slice(0, 20)
        .map((h, i) => ({
            x: i,
            y: h.won ? h.payout : -h.betAmount
        }))
        .reverse()

    const pnl = stats.totalWon - stats.totalWagered

    return (
        <>
            <Confetti active={showConfetti} />

            <div className='max-w-5xl mx-auto space-y-4'>
                {/* Performance Bar - Condensed Stats */}
                <div className='glass-card'>
                    <div className='flex items-center justify-between p-4 border-b border-white/5'>
                        <div className='flex items-center gap-3'>
                            <GameIcon game="dice" size="md" showGlow={true} />
                            <div>
                                <h1 className='text-lg font-bold text-white'>Dice</h1>
                                <p className='text-xs text-white/40'>Roll over or under target</p>
                            </div>
                        </div>
                        <div className='flex items-center gap-1 text-xs'>
                            <span className='text-white/30'>House Edge:</span>
                            <span className='text-[#7fffd4] font-mono font-bold'>1%</span>
                        </div>
                    </div>

                    {/* Performance Bar */}
                    <div className='performance-bar mx-4 my-3 flex items-center gap-6'>
                        {/* Mini Sparkline */}
                        <div className='hidden sm:block'>
                            <svg className='sparkline' viewBox='0 0 60 24'>
                                <defs>
                                    <linearGradient id='sparkline-gradient' x1='0' y1='0' x2='0' y2='1'>
                                        <stop offset='0%' stopColor='#7fffd4' stopOpacity='0.3' />
                                        <stop offset='100%' stopColor='#7fffd4' stopOpacity='0' />
                                    </linearGradient>
                                </defs>
                                {sparklineData.length > 1 && (
                                    <path
                                        className='sparkline-path'
                                        d={sparklineData
                                            .map((d, i) => {
                                                const x = (i / (sparklineData.length - 1)) * 60
                                                const y = 12 - d.y * 4
                                                return `${i === 0 ? "M" : "L"} ${x} ${Math.max(2, Math.min(22, y))}`
                                            })
                                            .join(" ")}
                                    />
                                )}
                            </svg>
                        </div>

                        <div className='flex items-center gap-6 flex-1'>
                            <div className='flex items-center gap-2'>
                                <span className='text-[10px] text-white/30 uppercase'>W/L</span>
                                <span className='font-mono text-sm'>
                                    <span className='text-[#00ff88]'>{stats.wins}</span>
                                    <span className='text-white/20'>/</span>
                                    <span className='text-[#ff4757]'>{stats.losses}</span>
                                </span>
                            </div>

                            <div className='h-4 w-px bg-white/10' />

                            <div className='flex items-center gap-2'>
                                <span className='text-[10px] text-white/30 uppercase'>Wagered</span>
                                <span className='font-mono text-sm text-white'>{stats.totalWagered.toFixed(2)}</span>
                            </div>

                            <div className='h-4 w-px bg-white/10' />

                            <div className='flex items-center gap-2'>
                                <span className='text-[10px] text-white/30 uppercase'>PnL</span>
                                <span
                                    className={`font-mono text-sm font-bold ${
                                        pnl >= 0 ? "text-[#00ff88] text-glow-green" : "text-[#ff4757] text-glow-red"
                                    }`}
                                >
                                    {pnl >= 0 ? "+" : ""}
                                    {pnl.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className='grid lg:grid-cols-3 gap-4'>
                    {/* Main Game Area */}
                    <div className='lg:col-span-2 space-y-4'>
                        {/* Dice Display */}
                        <div className='glass-card p-6'>
                            {/* Large Number Display */}
                            <div className='text-center mb-6'>
                                <motion.div
                                    key={gamePhase === "rolling" ? "rolling" : diceResult}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className='relative inline-block'
                                >
                                    <div
                                        className={`text-[120px] leading-none font-bold font-mono transition-all duration-100 ${
                                            gameResult === "win"
                                                ? "text-[#00ff88] text-glow-green"
                                                : gameResult === "lose"
                                                ? "text-[#ff4757] text-glow-red"
                                                : gamePhase === "rolling"
                                                ? "text-[#7fffd4] text-glow-mint"
                                                : "text-white/20"
                                        }`}
                                    >
                                        {gamePhase === "rolling"
                                            ? rollingNumber.toString().padStart(2, "0")
                                            : diceResult !== null
                                            ? diceResult.toString().padStart(2, "0")
                                            : "00"}
                                    </div>
                                    {gameResult && (
                                        <motion.div
                                            initial={{ y: 10, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            className={`text-sm font-bold uppercase tracking-widest mt-2 ${
                                                gameResult === "win" ? "text-[#00ff88]" : "text-[#ff4757]"
                                            }`}
                                        >
                                            {gameResult === "win" ? "Winner" : "No luck"}
                                        </motion.div>
                                    )}
                                </motion.div>
                            </div>

                            {/* Neon Slider Track */}
                            <div className='space-y-6 px-2'>
                                <div className='relative h-16'>
                                    {/* Gradient Track Background */}
                                    <div className='absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full overflow-hidden'>
                                        <div
                                            className='h-full transition-all duration-200'
                                            style={{
                                                background: rollOver
                                                    ? `linear-gradient(90deg, rgba(255,71,87,0.4) 0%, rgba(255,71,87,0.4) ${target}%, rgba(0,255,136,0.4) ${target}%, rgba(0,255,136,0.4) 100%)`
                                                    : `linear-gradient(90deg, rgba(0,255,136,0.4) 0%, rgba(0,255,136,0.4) ${target}%, rgba(255,71,87,0.4) ${target}%, rgba(255,71,87,0.4) 100%)`
                                            }}
                                        />
                                        {/* Glow overlay based on win chance */}
                                        <div
                                            className='absolute inset-0 transition-all duration-300'
                                            style={{
                                                boxShadow:
                                                    winChance > 50
                                                        ? `0 0 ${winChance / 3}px rgba(0,255,136,0.5)`
                                                        : `0 0 ${(100 - winChance) / 3}px rgba(255,71,87,0.3)`
                                            }}
                                        />
                                    </div>

                                    {/* Result Marker */}
                                    <AnimatePresence>
                                        {diceResult !== null && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0, opacity: 0 }}
                                                className='absolute top-1/2 -translate-y-1/2 z-20'
                                                style={{ left: `${diceResult}%` }}
                                            >
                                                <div
                                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                                        gameResult === "win"
                                                            ? "bg-[#00ff88] border-white shadow-[0_0_20px_rgba(0,255,136,0.8)]"
                                                            : "bg-[#ff4757] border-white shadow-[0_0_20px_rgba(255,71,87,0.8)]"
                                                    }`}
                                                >
                                                    <span className='text-[8px] font-bold text-black'>
                                                        {diceResult}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Target Indicator */}
                                    <div
                                        className='absolute top-1/2 -translate-y-1/2 z-10 transition-all duration-100'
                                        style={{ left: `${target}%` }}
                                    >
                                        <div className='relative'>
                                            <div className='w-1 h-10 bg-[#7fffd4] rounded-full shadow-[0_0_15px_rgba(127,255,212,0.8)]' />
                                            <div className='absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#7fffd4] text-black rounded text-xs font-bold font-mono whitespace-nowrap'>
                                                {target}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Neon Slider Input */}
                                    <input
                                        type='range'
                                        min={2}
                                        max={98}
                                        value={target}
                                        onChange={(e) => setTarget(parseInt(e.target.value))}
                                        disabled={isProcessing}
                                        className={`neon-slider absolute inset-x-0 top-1/2 -translate-y-1/2 ${
                                            winChance > 60 ? "high-chance" : winChance < 40 ? "low-chance" : ""
                                        }`}
                                        style={{ opacity: 0, cursor: isProcessing ? "not-allowed" : "pointer" }}
                                    />
                                </div>

                                {/* Scale Labels */}
                                <div className='flex justify-between text-[10px] text-white/30 font-mono px-1'>
                                    <span>0</span>
                                    <span>25</span>
                                    <span>50</span>
                                    <span>75</span>
                                    <span>100</span>
                                </div>
                            </div>

                            {/* Roll Over / Roll Under Toggle */}
                            <div className='flex justify-center mt-8'>
                                <div className='inline-flex bg-black/40 rounded-xl p-1 border border-white/5'>
                                    <button
                                        onClick={() => setRollOver(false)}
                                        disabled={isProcessing}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                                            !rollOver
                                                ? "bg-[#7fffd4] text-black shadow-[0_0_20px_rgba(127,255,212,0.4)]"
                                                : "text-white/50 hover:text-white hover:bg-white/5"
                                        }`}
                                    >
                                        <ArrowDown className='w-4 h-4' />
                                        Under {target}
                                    </button>
                                    <button
                                        onClick={() => setRollOver(true)}
                                        disabled={isProcessing}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                                            rollOver
                                                ? "bg-[#00ff88] text-black shadow-[0_0_20px_rgba(0,255,136,0.4)]"
                                                : "text-white/50 hover:text-white hover:bg-white/5"
                                        }`}
                                    >
                                        <ArrowUp className='w-4 h-4' />
                                        Over {target}
                                    </button>
                                </div>
                            </div>

                            {/* Phase Status */}
                            {gamePhase === "sending" && (
                                <div className='mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center animate-pulse-slow'>
                                    <div className='flex items-center justify-center gap-2 text-emerald-400'>
                                        <Loader2 className='w-5 h-5 animate-spin' />
                                        <span className='font-bold'>Processing bet...</span>
                                    </div>
                                </div>
                            )}

                            {gamePhase === "rolling" && (
                                <div className='mt-6 p-4 bg-primary/10 border border-primary/30 rounded-lg text-center'>
                                    <div className='flex items-center justify-center gap-2 text-primary'>
                                        <Loader2 className='w-5 h-5 animate-spin' />
                                        <span className='font-bold'>Rolling dice...</span>
                                    </div>
                                </div>
                            )}

                            {/* Result */}
                            {gamePhase === "result" && gameResult && (
                                <div
                                    className={`mt-6 p-6 rounded-xl text-center ${
                                        gameResult === "win"
                                            ? "bg-green-500/20 border-2 border-green-500/40"
                                            : "bg-red-500/20 border-2 border-red-500/40"
                                    }`}
                                >
                                    <div className='flex items-center justify-center gap-2 mb-2'>
                                        {gameResult === "win" ? (
                                            <Trophy className='w-8 h-8 text-emerald-400' />
                                        ) : (
                                            <TrendingDown className='w-8 h-8 text-red-400' />
                                        )}
                                    </div>
                                    <div className='text-3xl font-bold mb-2'>
                                        {gameResult === "win" ? (
                                            <span className='text-green-400'>
                                                +{(parseFloat(betAmount) * multiplier).toFixed(4)} SOL
                                            </span>
                                        ) : (
                                            <span className='text-red-400'>
                                                -{parseFloat(betAmount).toFixed(4)} SOL
                                            </span>
                                        )}
                                    </div>
                                    <p className='text-sm text-muted-foreground mb-4'>
                                        Rolled {diceResult} • Target was {rollOver ? `>${target}` : `<${target}`}
                                    </p>

                                    {provablyFairData && (
                                        <div className='text-xs text-muted-foreground space-y-1 mb-4'>
                                            <div className='flex items-center justify-center gap-2'>
                                                <Hash className='w-3 h-3' />
                                                <span>Blockhash: {provablyFairData.blockhash.slice(0, 16)}...</span>
                                            </div>
                                            <div className='flex items-center justify-center gap-2'>
                                                <Clock className='w-3 h-3' />
                                                <span>Slot: {provablyFairData.slot}</span>
                                            </div>
                                        </div>
                                    )}

                                    {txSignature && (
                                        <a
                                            href={getExplorerUrl(txSignature, SOLANA_NETWORK)}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='inline-flex items-center gap-2 text-sm text-primary hover:text-accent transition-colors'
                                        >
                                            View Transaction
                                            <ExternalLink className='w-4 h-4' />
                                        </a>
                                    )}

                                    <button
                                        onClick={resetGame}
                                        className='mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors block mx-auto'
                                    >
                                        Play Again
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Betting Panel */}
                    <div className='space-y-6'>
                        <div className='glass-card p-6 space-y-4'>
                            <div className='flex items-center justify-between'>
                                <span className='text-sm text-muted-foreground'>Bet Amount</span>
                                <span className='text-sm font-mono text-primary'>
                                    Balance: {balance.toFixed(4)} SOL
                                </span>
                            </div>

                            {/* Bet Input */}
                            <div className='relative'>
                                <input
                                    type='number'
                                    value={betAmount}
                                    onChange={(e) => setBetAmount(e.target.value)}
                                    placeholder='0.00'
                                    disabled={isProcessing}
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
                                        disabled={isProcessing}
                                        className='px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-primary/20 hover:border-primary/50 transition-all disabled:opacity-50'
                                    >
                                        {amount}
                                    </button>
                                ))}
                            </div>

                            {/* Stats Display */}
                            <div className='grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg'>
                                <div>
                                    <div className='text-xs text-muted-foreground mb-1'>Multiplier</div>
                                    <div className='text-xl font-bold text-primary'>{multiplier.toFixed(4)}x</div>
                                </div>
                                <div>
                                    <div className='text-xs text-muted-foreground mb-1'>Win Chance</div>
                                    <div className='text-xl font-bold text-accent'>{winChance.toFixed(2)}%</div>
                                </div>
                            </div>

                            {/* Potential Win */}
                            {potentialWin > 0 && (
                                <div className='flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg'>
                                    <span className='text-sm text-green-400'>Potential Win</span>
                                    <span className='text-lg font-bold text-green-400'>
                                        {potentialWin.toFixed(4)} SOL
                                    </span>
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className='flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400'>
                                    <AlertCircle className='w-4 h-4' />
                                    <span className='text-sm'>{error}</span>
                                </div>
                            )}

                            {/* Roll Button */}
                            <button
                                onClick={rollDice}
                                disabled={isProcessing || gamePhase === "result"}
                                className='w-full bg-gradient-to-r from-[#7fffd4] to-[#5cccaa] hover:shadow-[0_0_40px_rgba(127,255,212,0.6)] transition-all duration-300 px-6 py-4 rounded-full font-bold text-[#0a1f1c] text-lg disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group'
                            >
                                <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700' />
                                <span className='relative flex items-center justify-center gap-2'>
                                    <Dices className='w-5 h-5' />
                                    {isProcessing ? "Rolling..." : "Roll Dice"}
                                </span>
                            </button>

                            <p className='text-xs text-center text-muted-foreground'>House Edge: 1% • Provably Fair</p>
                        </div>

                        {/* Recent Rolls */}
                        {history.length > 0 && (
                            <div className='glass-card p-4'>
                                <h4 className='text-sm font-bold text-white mb-3'>Recent Rolls</h4>
                                <div className='space-y-2 max-h-60 overflow-y-auto'>
                                    {history.slice(0, 10).map((entry) => (
                                        <div
                                            key={entry.id}
                                            className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                                                entry.won ? "bg-green-500/10" : "bg-red-500/10"
                                            }`}
                                        >
                                            <div className='flex items-center gap-2'>
                                                <span
                                                    className={`font-mono font-bold ${
                                                        entry.won ? "text-green-400" : "text-red-400"
                                                    }`}
                                                >
                                                    {entry.result}
                                                </span>
                                                <span className='text-muted-foreground text-xs'>
                                                    {entry.rollOver ? ">" : "<"}
                                                    {entry.target}
                                                </span>
                                            </div>
                                            <span
                                                className={`font-mono ${entry.won ? "text-green-400" : "text-red-400"}`}
                                            >
                                                {entry.won ? "+" : "-"}
                                                {entry.won ? entry.payout.toFixed(4) : entry.betAmount.toFixed(4)}
                                            </span>
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
