import { useState, useEffect, useRef } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { SystemProgram, Transaction } from "@solana/web3.js"
import { getBalance, solToLamports } from "../../../utils/solana"
import { Loader2, AlertCircle, Trash2, RotateCcw } from "lucide-react"
import { GameIcon } from "../../ui/GameIcon"
import { COMMITMENT } from "../../../config/solana-config"
import { HOUSE_WALLET } from "../../../config/game-config"
import { processPayout } from "../../../utils/payoutService"
import { soundEffects } from "../../../utils/soundEffects"
import { Confetti } from "../../Confetti"
import { motion } from "framer-motion"

type GamePhase = "betting" | "sending" | "spinning" | "result"

interface Bet {
    type: "number" | "red" | "black" | "even" | "odd" | "low" | "high"
    value?: number
    amount: number
}

interface GameStats {
    wins: number
    losses: number
    totalWagered: number
    totalWon: number
}

// European roulette wheel order
const WHEEL_ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29,
    7, 28, 12, 35, 3, 26
]

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]

const getNumberColor = (num: number): "red" | "black" | "green" => {
    if (num === 0) return "green"
    return RED_NUMBERS.includes(num) ? "red" : "black"
}

const CHIP_VALUES = [0.01, 0.05, 0.1, 0.5, 1]

export const RouletteGame = () => {
    const { publicKey, sendTransaction, connected } = useWallet()
    const { connection } = useConnection()
    const wheelRef = useRef<HTMLDivElement>(null)

    const [gamePhase, setGamePhase] = useState<GamePhase>("betting")
    const [selectedChip, setSelectedChip] = useState(0.1)
    const [bets, setBets] = useState<Bet[]>([])
    const [result, setResult] = useState<number | null>(null)
    const [winAmount, setWinAmount] = useState<number>(0)
    const [balance, setBalance] = useState<number>(0)
    const [error, setError] = useState<string>("")
    const [showConfetti, setShowConfetti] = useState(false)
    const [wheelRotation, setWheelRotation] = useState(0)
    const [history, setHistory] = useState<number[]>([])
    const [stats, setStats] = useState<GameStats>({
        wins: 0,
        losses: 0,
        totalWagered: 0,
        totalWon: 0
    })
    const [hoveredNumber, setHoveredNumber] = useState<number | null>(null)

    const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0)
    const pnl = stats.totalWon - stats.totalWagered

    // Get neighbors of a number on the wheel (for neighbor betting hints)
    const getNeighbors = (num: number, count: number = 2): number[] => {
        const idx = WHEEL_ORDER.indexOf(num)
        if (idx === -1) return []
        const neighbors: number[] = []
        for (let i = -count; i <= count; i++) {
            const neighborIdx = (idx + i + WHEEL_ORDER.length) % WHEEL_ORDER.length
            neighbors.push(WHEEL_ORDER[neighborIdx])
        }
        return neighbors
    }

    const neighborNumbers = hoveredNumber !== null ? getNeighbors(hoveredNumber) : []

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

    const addBet = (type: Bet["type"], value?: number) => {
        if (gamePhase !== "betting") return
        if (totalBet + selectedChip > balance) {
            setError("Insufficient balance")
            return
        }

        setError("")
        soundEffects.playClick()

        // Check if bet already exists
        const existingIndex = bets.findIndex((b) => b.type === type && b.value === value)
        if (existingIndex >= 0) {
            // Add to existing bet
            setBets((prev) => prev.map((b, i) => (i === existingIndex ? { ...b, amount: b.amount + selectedChip } : b)))
        } else {
            // New bet
            setBets((prev) => [...prev, { type, value, amount: selectedChip }])
        }
    }

    const clearBets = () => {
        setBets([])
        setError("")
    }

    const undoBet = () => {
        setBets((prev) => prev.slice(0, -1))
    }

    const spin = async () => {
        if (bets.length === 0) {
            setError("Place at least one bet")
            return
        }

        if (totalBet > balance) {
            setError("Insufficient balance")
            return
        }

        if (!publicKey) return

        setError("")
        setGamePhase("sending")

        try {
            // Send bet to house
            const betTransaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: HOUSE_WALLET,
                    lamports: solToLamports(totalBet)
                })
            )

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(COMMITMENT)
            betTransaction.recentBlockhash = blockhash
            betTransaction.feePayer = publicKey

            const signature = await sendTransaction(betTransaction, connection)
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, COMMITMENT)

            // Generate result
            setGamePhase("spinning")
            soundEffects.playFlip()

            // Random number 0-36
            const winningNumber = Math.floor(Math.random() * 37)
            const numberIndex = WHEEL_ORDER.indexOf(winningNumber)
            const degreesPerNumber = 360 / 37

            // Calculate absolute rotation to bring winning number to top
            // Each number i is at i * degreesPerNumber.
            // To bring it to 0 (top), container needs to rotate by -(i * degreesPerNumber)
            const spins = 5
            const currentRotation = wheelRotation
            const winningAngle = numberIndex * degreesPerNumber
            const targetRotation = (Math.floor(currentRotation / 360) + spins + 1) * 360 - winningAngle

            setWheelRotation(targetRotation)

            // Wait for animation (5s matches the transition duration in CSS)
            await new Promise((resolve) => setTimeout(resolve, 5000))

            setResult(winningNumber)
            setHistory((prev) => [winningNumber, ...prev].slice(0, 20))

            // Calculate winnings
            let totalWin = 0
            const winningColor = getNumberColor(winningNumber)

            bets.forEach((bet) => {
                switch (bet.type) {
                    case "number":
                        if (bet.value === winningNumber) {
                            totalWin += bet.amount * 36 // 35:1 + original
                        }
                        break
                    case "red":
                        if (winningColor === "red") {
                            totalWin += bet.amount * 2
                        }
                        break
                    case "black":
                        if (winningColor === "black") {
                            totalWin += bet.amount * 2
                        }
                        break
                    case "even":
                        if (winningNumber !== 0 && winningNumber % 2 === 0) {
                            totalWin += bet.amount * 2
                        }
                        break
                    case "odd":
                        if (winningNumber % 2 === 1) {
                            totalWin += bet.amount * 2
                        }
                        break
                    case "low":
                        if (winningNumber >= 1 && winningNumber <= 18) {
                            totalWin += bet.amount * 2
                        }
                        break
                    case "high":
                        if (winningNumber >= 19 && winningNumber <= 36) {
                            totalWin += bet.amount * 2
                        }
                        break
                }
            })

            setWinAmount(totalWin)
            setGamePhase("result")

            if (totalWin > 0) {
                soundEffects.playWin()
                setShowConfetti(true)
                setTimeout(() => setShowConfetti(false), 4000)
                setStats((prev) => ({
                    ...prev,
                    wins: prev.wins + 1,
                    totalWagered: prev.totalWagered + totalBet,
                    totalWon: prev.totalWon + totalWin
                }))

                // Process payout
                await processPayout(connection, {
                    playerWallet: publicKey.toBase58(),
                    amount: totalWin,
                    gameId: `roulette_${Date.now()}`,
                    blockhash: "",
                    slot: 0
                })
            } else {
                soundEffects.playLose()
                setStats((prev) => ({
                    ...prev,
                    losses: prev.losses + 1,
                    totalWagered: prev.totalWagered + totalBet
                }))
            }
        } catch (err: any) {
            if (err.message?.includes("User rejected")) {
                setError("Transaction cancelled")
            } else {
                setError("Failed to place bet")
            }
            setGamePhase("betting")
        }
    }

    const newGame = () => {
        setBets([])
        setResult(null)
        setWinAmount(0)
        setGamePhase("betting")
    }

    const isSpinning = gamePhase === "spinning" || gamePhase === "sending"

    if (!connected) {
        return (
            <div className='glass-card p-8 text-center'>
                <CircleDashed className='w-12 h-12 mx-auto mb-4 text-muted-foreground' />
                <p className='text-muted-foreground'>Connect your wallet to play Roulette</p>
            </div>
        )
    }

    return (
        <>
            <Confetti active={showConfetti} />

            <div className='max-w-6xl mx-auto space-y-4'>
                {/* Header & Performance Bar */}
                <div className='glass-card'>
                    <div className='flex items-center justify-between p-4 border-b border-white/5'>
                        <div className='flex items-center gap-3'>
                            <GameIcon game="roulette" size="md" showGlow={true} />
                            <div>
                                <h1 className='text-lg font-bold text-white'>Roulette</h1>
                                <p className='text-xs text-white/40'>European Single Zero</p>
                            </div>
                        </div>
                        <div className='flex items-center gap-1 text-xs'>
                            <span className='text-white/30'>House Edge:</span>
                            <span className='text-amber-400 font-mono font-bold'>2.7%</span>
                        </div>
                    </div>

                    {/* Performance Bar */}
                    <div className='performance-bar mx-4 my-3 flex items-center gap-6'>
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

                        {/* History Strip */}
                        <div className='hidden md:flex items-center gap-1'>
                            {history.slice(0, 8).map((num, i) => (
                                <motion.div
                                    key={`${num}-${i}`}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono ${
                                        getNumberColor(num) === "red"
                                            ? "bg-[#ff4757]/30 text-[#ff4757]"
                                            : getNumberColor(num) === "black"
                                            ? "bg-white/10 text-white/70"
                                            : "bg-[#00ff88]/30 text-[#00ff88]"
                                    }`}
                                >
                                    {num}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className='grid lg:grid-cols-4 gap-6'>
                    {/* Wheel & Result */}
                    <div className='lg:col-span-1 space-y-4'>
                        {/* Wheel */}
                        <div className='glass-card p-4'>
                            <div className='relative w-48 h-48 mx-auto'>
                                {/* Wheel */}
                                <div
                                    ref={wheelRef}
                                    className='absolute inset-0 rounded-full border-4 border-emerald-600 overflow-hidden transition-transform ease-out'
                                    style={{
                                        transform: `rotate(${wheelRotation}deg)`,
                                        transitionDuration: isSpinning ? "5s" : "0s"
                                    }}
                                >
                                    {WHEEL_ORDER.map((num, i) => {
                                        const color = getNumberColor(num)
                                        const angle = (i / 37) * 360
                                        return (
                                            <div
                                                key={num}
                                                className='absolute w-full h-full'
                                                style={{
                                                    transform: `rotate(${angle}deg)`,
                                                    transformOrigin: "center"
                                                }}
                                            >
                                                <div
                                                    className={`absolute top-0 left-1/2 -translate-x-1/2 w-6 h-20 origin-bottom ${
                                                        color === "red"
                                                            ? "bg-red-600"
                                                            : color === "black"
                                                            ? "bg-gray-900"
                                                            : "bg-green-600"
                                                    }`}
                                                    style={{
                                                        clipPath: "polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)"
                                                    }}
                                                >
                                                    <span className='absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white'>
                                                        {num}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Ball indicator */}
                                <div className='absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-3 h-3 bg-white rounded-full shadow-lg z-10' />

                                {/* Center */}
                                <div className='absolute inset-10 rounded-full bg-[#1a1a1a] border-4 border-emerald-600/50 flex items-center justify-center z-20 shadow-[0_0_20px_rgba(0,0,0,0.5)]'>
                                    {result !== null && gamePhase === "result" ? (
                                        <div
                                            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg ${
                                                getNumberColor(result) === "red"
                                                    ? "bg-red-600 text-white"
                                                    : getNumberColor(result) === "black"
                                                    ? "bg-gray-900 text-white"
                                                    : "bg-green-600 text-white"
                                            }`}
                                        >
                                            {result}
                                        </div>
                                    ) : (
                                        <div className='w-12 h-12 rounded-full border-2 border-dashed border-emerald-600/30 animate-spin-slow' />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* History */}
                        {history.length > 0 && (
                            <div className='glass-card p-4'>
                                <h4 className='text-sm font-bold text-white mb-2'>History</h4>
                                <div className='flex flex-wrap gap-1'>
                                    {history.slice(0, 10).map((num, i) => (
                                        <div
                                            key={i}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                                getNumberColor(num) === "red"
                                                    ? "bg-red-600 text-white"
                                                    : getNumberColor(num) === "black"
                                                    ? "bg-gray-900 text-white"
                                                    : "bg-green-600 text-white"
                                            }`}
                                        >
                                            {num}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Chip Selector */}
                        <div className='glass-card p-4'>
                            <h4 className='text-sm font-bold text-white mb-2'>Select Chip</h4>
                            <div className='flex flex-wrap gap-2'>
                                {CHIP_VALUES.map((value) => (
                                    <button
                                        key={value}
                                        onClick={() => setSelectedChip(value)}
                                        disabled={isSpinning}
                                        className={`w-12 h-12 rounded-full font-bold text-xs transition-all ${
                                            selectedChip === value
                                                ? "bg-primary text-[#0a1f1c] scale-110 shadow-[0_0_15px_rgba(127,255,212,0.5)]"
                                                : "bg-white/10 text-white hover:bg-white/20"
                                        }`}
                                    >
                                        {value}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Betting Table */}
                    <div className='lg:col-span-3 glass-card p-4'>
                        {/* Racetrack Layout */}
                        <div className='mb-6'>
                            <div className='flex items-center gap-2 mb-3'>
                                <span className='text-[10px] text-white/30 uppercase tracking-wider font-semibold'>
                                    Racetrack
                                </span>
                                <span className='text-[9px] text-white/20'>• Hover to see neighbors</span>
                            </div>
                            <div className='racetrack justify-center'>
                                {WHEEL_ORDER.map((num) => {
                                    const color = getNumberColor(num)
                                    const hasBet = bets.find((b) => b.type === "number" && b.value === num)
                                    const isNeighbor = neighborNumbers.includes(num)
                                    const isResult = result === num

                                    return (
                                        <button
                                            key={num}
                                            onClick={() => addBet("number", num)}
                                            onMouseEnter={() => setHoveredNumber(num)}
                                            onMouseLeave={() => setHoveredNumber(null)}
                                            disabled={isSpinning}
                                            className={`racetrack-number ${color} ${hasBet ? "selected" : ""} ${
                                                isNeighbor && !hasBet ? "neighbor-highlight" : ""
                                            } ${
                                                isResult
                                                    ? "ring-2 ring-emerald-400 scale-125 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                                                    : ""
                                            }`}
                                        >
                                            {num}
                                            {hasBet && (
                                                <span className='absolute -top-1 -right-1 w-3 h-3 bg-[#7fffd4] rounded-full text-[7px] text-black font-bold flex items-center justify-center'>
                                                    {hasBet.amount}
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Numbers Grid - Compact */}
                        <div className='mb-4'>
                            <div className='flex items-center gap-2 mb-3'>
                                <span className='text-[10px] text-white/30 uppercase tracking-wider font-semibold'>
                                    Number Grid
                                </span>
                            </div>
                            <div className='grid grid-cols-13 gap-1'>
                                {/* Zero */}
                                <button
                                    onClick={() => addBet("number", 0)}
                                    disabled={isSpinning}
                                    className={`col-span-1 row-span-3 h-20 bg-[#00ff88]/30 hover:bg-[#00ff88]/50 border border-[#00ff88]/30 rounded-lg font-bold font-mono text-[#00ff88] text-xl transition-all ${
                                        result === 0
                                            ? "ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                                            : ""
                                    }`}
                                >
                                    0
                                </button>

                                {/* Numbers 1-36 */}
                                {[...Array(36)].map((_, i) => {
                                    const num = i + 1
                                    const color = getNumberColor(num)
                                    const row = 2 - ((num - 1) % 3)
                                    const col = Math.floor((num - 1) / 3) + 2
                                    const hasBet = bets.find((b) => b.type === "number" && b.value === num)

                                    return (
                                        <button
                                            key={num}
                                            onClick={() => addBet("number", num)}
                                            disabled={isSpinning}
                                            className={`h-6 rounded font-bold font-mono text-xs transition-all relative ${
                                                color === "red"
                                                    ? "bg-[#ff4757]/30 hover:bg-[#ff4757]/50 text-[#ff4757] border border-[#ff4757]/20"
                                                    : "bg-white/5 hover:bg-white/10 text-white/70 border border-white/5"
                                            } ${
                                                result === num
                                                    ? "ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                                                    : ""
                                            } ${hasBet ? "ring-1 ring-[#7fffd4]" : ""}`}
                                            style={{
                                                gridColumn: col,
                                                gridRow: row + 1
                                            }}
                                        >
                                            {num}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Outside Bets */}
                        <div className='grid grid-cols-6 gap-2 mb-4'>
                            <button
                                onClick={() => addBet("low")}
                                disabled={isSpinning}
                                className='py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-white text-sm transition-colors'
                            >
                                1-18
                                {bets.find((b) => b.type === "low") && (
                                    <span className='ml-1 text-primary'>
                                        {bets.find((b) => b.type === "low")?.amount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => addBet("even")}
                                disabled={isSpinning}
                                className='py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-white text-sm transition-colors'
                            >
                                EVEN
                                {bets.find((b) => b.type === "even") && (
                                    <span className='ml-1 text-primary'>
                                        {bets.find((b) => b.type === "even")?.amount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => addBet("red")}
                                disabled={isSpinning}
                                className='py-3 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-white text-sm transition-colors'
                            >
                                RED
                                {bets.find((b) => b.type === "red") && (
                                    <span className='ml-1'>{bets.find((b) => b.type === "red")?.amount}</span>
                                )}
                            </button>
                            <button
                                onClick={() => addBet("black")}
                                disabled={isSpinning}
                                className='py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold text-white text-sm transition-colors'
                            >
                                BLACK
                                {bets.find((b) => b.type === "black") && (
                                    <span className='ml-1'>{bets.find((b) => b.type === "black")?.amount}</span>
                                )}
                            </button>
                            <button
                                onClick={() => addBet("odd")}
                                disabled={isSpinning}
                                className='py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-white text-sm transition-colors'
                            >
                                ODD
                                {bets.find((b) => b.type === "odd") && (
                                    <span className='ml-1 text-primary'>
                                        {bets.find((b) => b.type === "odd")?.amount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => addBet("high")}
                                disabled={isSpinning}
                                className='py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-white text-sm transition-colors'
                            >
                                19-36
                                {bets.find((b) => b.type === "high") && (
                                    <span className='ml-1 text-primary'>
                                        {bets.find((b) => b.type === "high")?.amount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Bet Info & Actions */}
                        <div className='flex flex-wrap items-center justify-between gap-4'>
                            <div className='flex items-center gap-4'>
                                <div className='text-sm text-muted-foreground'>
                                    Total Bet: <span className='font-bold text-white'>{totalBet.toFixed(4)} SOL</span>
                                </div>
                                <div className='text-sm text-muted-foreground'>
                                    Balance: <span className='font-bold text-primary'>{balance.toFixed(4)} SOL</span>
                                </div>
                            </div>

                            <div className='flex items-center gap-2'>
                                {gamePhase === "betting" && (
                                    <>
                                        <button
                                            onClick={undoBet}
                                            disabled={bets.length === 0}
                                            className='px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white flex items-center gap-2 disabled:opacity-50'
                                        >
                                            <RotateCcw className='w-4 h-4' />
                                            Undo
                                        </button>
                                        <button
                                            onClick={clearBets}
                                            disabled={bets.length === 0}
                                            className='px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 flex items-center gap-2 disabled:opacity-50'
                                        >
                                            <Trash2 className='w-4 h-4' />
                                            Clear
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className='mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400'>
                                <AlertCircle className='w-4 h-4' />
                                <span className='text-sm'>{error}</span>
                            </div>
                        )}

                        {/* Result */}
                        {gamePhase === "result" && (
                            <div
                                className={`mt-4 p-4 rounded-lg text-center ${
                                    winAmount > 0
                                        ? "bg-green-500/20 border border-green-500/40"
                                        : "bg-red-500/20 border border-red-500/40"
                                }`}
                            >
                                <div className='text-3xl font-bold mb-2'>
                                    {winAmount > 0 ? (
                                        <span className='text-green-400'>+{winAmount.toFixed(4)} SOL</span>
                                    ) : (
                                        <span className='text-red-400'>-{totalBet.toFixed(4)} SOL</span>
                                    )}
                                </div>
                                <p className='text-muted-foreground'>
                                    Ball landed on{" "}
                                    <span
                                        className={`font-bold ${
                                            getNumberColor(result!) === "red"
                                                ? "text-red-400"
                                                : getNumberColor(result!) === "black"
                                                ? "text-white"
                                                : "text-green-400"
                                        }`}
                                    >
                                        {result}
                                    </span>
                                </p>
                            </div>
                        )}

                        {/* Spin / New Game Button */}
                        <div className='mt-4'>
                            {gamePhase === "result" ? (
                                <button
                                    onClick={newGame}
                                    className='w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] transition-all duration-300 px-6 py-4 rounded-full font-bold text-white text-lg'
                                >
                                    New Game
                                </button>
                            ) : (
                                <button
                                    onClick={spin}
                                    disabled={isSpinning || bets.length === 0}
                                    className='w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-[0_0_40px_rgba(127,255,212,0.4)] transition-all duration-300 px-6 py-4 rounded-xl font-bold text-white text-lg disabled:opacity-50 relative overflow-hidden group'
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
                                                <CircleDashed className='w-5 h-5' />
                                                SPIN
                                            </>
                                        )}
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Payouts Info */}
                        <div className='mt-4 text-xs text-center text-muted-foreground'>
                            Numbers: 35:1 • Red/Black/Even/Odd/Low/High: 1:1 • House Edge: 2.7%
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
