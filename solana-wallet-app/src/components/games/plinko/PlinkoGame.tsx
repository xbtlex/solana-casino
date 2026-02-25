import { useState, useEffect, useRef, useCallback } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { SystemProgram, Transaction } from "@solana/web3.js"
import { getBalance, solToLamports } from "../../../utils/solana"
import { Loader2, AlertCircle } from "lucide-react"
import { GameIcon } from "../../ui/GameIcon"
import { COMMITMENT } from "../../../config/solana-config"
import { HOUSE_WALLET } from "../../../config/game-config"
import { processPayout } from "../../../utils/payoutService"
import { soundEffects } from "../../../utils/soundEffects"
import { Confetti } from "../../Confetti"

type RiskLevel = "low" | "medium" | "high"
type GamePhase = "betting" | "sending" | "dropping" | "result"

interface Ball {
    x: number
    y: number
    vx: number
    vy: number
    radius: number
}

interface ActiveBall extends Ball {
    id: string
    betAmount: number
}

interface GameStats {
    wins: number
    losses: number
    totalWagered: number
    totalWon: number
}

const ROWS = 12 // Reduced rows for better ball flow
const MIN_BET = 0.001
const MAX_BET = 5
const GRAVITY = 0.4 // Increased gravity
const BOUNCE = 0.6 // Less bouncy
const FRICTION = 0.98

// Multipliers for each risk level (13 slots for 12 rows)
const MULTIPLIERS: Record<RiskLevel, number[]> = {
    low: [3, 1.5, 1.2, 1.0, 0.7, 0.4, 0.3, 0.4, 0.7, 1.0, 1.2, 1.5, 3],
    medium: [8, 3, 1.5, 0.5, 0.3, 0.2, 0.2, 0.2, 0.3, 0.5, 1.5, 3, 8],
    high: [50, 15, 5, 3, 1.5, 0.5, 0.2, 0.5, 1.5, 3, 5, 15, 50]
}

export const PlinkoGame = () => {
    const { publicKey, sendTransaction, connected } = useWallet()
    const { connection } = useConnection()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number>(0)

    const [betAmount, setBetAmount] = useState("")
    const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium")
    const [gamePhase, setGamePhase] = useState<GamePhase>("betting")
    const [balance, setBalance] = useState<number>(0)
    const [error, setError] = useState<string>("")
    const [balls, setBalls] = useState<ActiveBall[]>([])
    const [recentLandedSlot, setRecentLandedSlot] = useState<number | null>(null)
    const [winAmount, setWinAmount] = useState<number | null>(null)
    const [showConfetti, setShowConfetti] = useState(false)
    const [stats, setStats] = useState<GameStats>({
        wins: 0,
        losses: 0,
        totalWagered: 0,
        totalWon: 0
    })

    const multipliers = MULTIPLIERS[riskLevel]

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

    // Canvas dimensions and scaling
    const getCanvasConfig = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return null

        const width = canvas.width
        const height = canvas.height
        const pegRadius = 5
        const ballRadius = 8
        const startY = 30
        const endY = height - 60
        const rowHeight = (endY - startY) / ROWS

        return { width, height, pegRadius, ballRadius, startY, endY, rowHeight }
    }, [])

    // Draw the plinko board
    const drawBoard = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const config = getCanvasConfig()
        if (!config) return

        const { width, height, pegRadius, ballRadius, startY, rowHeight } = config

        // Clear
        ctx.fillStyle = "#0a0a1a"
        ctx.fillRect(0, 0, width, height)

        // Draw pegs
        const PEG_SPACING = 35 // Fixed spacing for a straight triangle
        for (let row = 0; row < ROWS; row++) {
            const pegsInRow = row + 1 // Start with 1 peg in first row
            const rowWidth = (pegsInRow - 1) * PEG_SPACING
            const startX = (width - rowWidth) / 2

            for (let peg = 0; peg < pegsInRow; peg++) {
                const x = startX + peg * PEG_SPACING
                const y = startY + rowHeight * row

                ctx.beginPath()
                ctx.arc(x, y, pegRadius, 0, Math.PI * 2)
                ctx.fillStyle = "#fff"
                ctx.fill()
            }
        }

        // Draw multiplier slots at bottom
        const slotWidth = (width - 20) / multipliers.length

        multipliers.forEach((mult, i) => {
            const x = 10 + slotWidth * i
            const y = height - 50

            // Color based on multiplier
            let color = "#ef4444" // Red for low
            if (mult >= 1) color = "#22c55e" // Green for good
            if (mult >= 5) color = "#00e5ff" // Cyan for great
            if (mult >= 10) color = "#f97316" // Orange for amazing
            if (mult >= 50) color = "#7fffd4" // Mint for incredible

            // Highlight landed slot
            if (recentLandedSlot === i) {
                ctx.fillStyle = color
                ctx.fillRect(x, y, slotWidth - 2, 45)
            } else {
                ctx.fillStyle = `${color}40`
                ctx.fillRect(x, y, slotWidth - 2, 45)
            }

            ctx.strokeStyle = color
            ctx.strokeRect(x, y, slotWidth - 2, 45)

            // Multiplier text
            ctx.fillStyle = recentLandedSlot === i ? "#000" : "#fff"
            ctx.font = "bold 10px sans-serif"
            ctx.textAlign = "center"
            ctx.fillText(`${mult}x`, x + slotWidth / 2 - 1, y + 28)
        })

        // Draw balls
        balls.forEach((ball) => {
            ctx.beginPath()
            ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2)
            const gradient = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, ballRadius)
            gradient.addColorStop(0, "#fff")
            gradient.addColorStop(1, "#7fffd4")
            ctx.fillStyle = gradient
            ctx.fill()

            // Glow effect
            ctx.shadowColor = "#7fffd4"
            ctx.shadowBlur = 10
            ctx.fill()
            ctx.shadowBlur = 0
        })
    }, [balls, multipliers, recentLandedSlot, getCanvasConfig])

    // Animation loop
    useEffect(() => {
        if (balls.length === 0) return

        const canvas = canvasRef.current
        if (!canvas) return

        const config = getCanvasConfig()
        if (!config) return

        const { width, height, pegRadius, ballRadius, startY, rowHeight } = config

        const animate = () => {
            setBalls((prevBalls) => {
                const nextBalls: ActiveBall[] = []

                prevBalls.forEach((ball) => {
                    let newBall = { ...ball }

                    // Apply gravity
                    newBall.vy += GRAVITY
                    // Apply friction
                    newBall.vx *= FRICTION
                    // Update position
                    newBall.x += newBall.vx
                    newBall.y += newBall.vy

                    // Wall collisions
                    if (newBall.x < ballRadius + 10) {
                        newBall.x = ballRadius + 10
                        newBall.vx *= -BOUNCE
                    }
                    if (newBall.x > width - ballRadius - 10) {
                        newBall.x = width - ballRadius - 10
                        newBall.vx *= -BOUNCE
                    }

                    // Peg collisions
                    const PEG_SPACING = 35
                    for (let row = 0; row < ROWS; row++) {
                        const pegsInRow = row + 1
                        const rowWidth = (pegsInRow - 1) * PEG_SPACING
                        const startX = (width - rowWidth) / 2

                        for (let peg = 0; peg < pegsInRow; peg++) {
                            const pegX = startX + peg * PEG_SPACING
                            const pegY = startY + rowHeight * row

                            const dx = newBall.x - pegX
                            const dy = newBall.y - pegY
                            const distance = Math.sqrt(dx * dx + dy * dy)

                            if (distance < ballRadius + pegRadius) {
                                const angle = Math.atan2(dy, dx)
                                const speed = Math.sqrt(newBall.vx * newBall.vx + newBall.vy * newBall.vy)
                                newBall.vx = Math.cos(angle) * speed * BOUNCE
                                newBall.vy = Math.sin(angle) * speed * BOUNCE
                                newBall.vx += (Math.random() - 0.5) * 2
                                const overlap = ballRadius + pegRadius - distance
                                newBall.x += Math.cos(angle) * overlap
                                newBall.y += Math.sin(angle) * overlap
                                soundEffects.playClick()
                            }
                        }
                    }

                    // Check if ball reached bottom
                    if (newBall.y >= height - 70) {
                        const slotWidth = (width - 20) / multipliers.length
                        let slot = Math.floor((newBall.x - 10) / slotWidth)
                        slot = Math.max(0, Math.min(slot, multipliers.length - 1))

                        setRecentLandedSlot(slot)

                        // Calculate winnings
                        const mult = multipliers[slot]
                        const amount = ball.betAmount * mult
                        setWinAmount(amount)
                        setGamePhase("result")

                        if (mult >= 1) {
                            soundEffects.playWin()
                            setShowConfetti(true)
                            setTimeout(() => setShowConfetti(false), 4000)
                        } else {
                            soundEffects.playLose()
                        }

                        // Process payout
                        if (publicKey && amount > 0) {
                            processPayout(connection, {
                                playerWallet: publicKey.toBase58(),
                                amount: amount,
                                gameId: `plinko_${Date.now()}`,
                                blockhash: "",
                                slot: 0
                            }).catch(console.error)
                        }

                        setStats((prev) => ({
                            ...prev,
                            wins: mult >= 1 ? prev.wins + 1 : prev.wins,
                            losses: mult < 1 ? prev.losses + 1 : prev.losses,
                            totalWagered: prev.totalWagered + ball.betAmount,
                            totalWon: prev.totalWon + amount
                        }))
                    } else {
                        nextBalls.push(newBall)
                    }
                })

                return nextBalls
            })
            animationRef.current = requestAnimationFrame(animate)
        }

        return () => cancelAnimationFrame(animationRef.current)
    }, [balls.length, multipliers, publicKey, connection, getCanvasConfig])

    // Draw on ball change
    useEffect(() => {
        drawBoard()
    }, [drawBoard])

    // Resize canvas
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const resize = () => {
            const container = canvas.parentElement
            if (container) {
                canvas.width = Math.min(container.clientWidth, 500)
                canvas.height = 600
                drawBoard()
            }
        }

        resize()
        window.addEventListener("resize", resize)
        return () => window.removeEventListener("resize", resize)
    }, [drawBoard])

    const dropBall = async () => {
        setError("")
        setWinAmount(null)

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

            // Start ball drop
            const canvas = canvasRef.current
            if (!canvas) return

            setGamePhase("dropping")
            soundEffects.playFlip()

            // Add new ball to the balls array
            const newBall: ActiveBall = {
                id: `ball_${Date.now()}`,
                betAmount: amount,
                x: canvas.width / 2 + (Math.random() - 0.5) * 20,
                y: 20,
                vx: (Math.random() - 0.5) * 2,
                vy: 0,
                radius: 8
            }

            setBalls((prev) => [...prev, newBall])
        } catch (err: any) {
            if (err.message?.includes("User rejected")) {
                setError("Transaction cancelled")
            } else {
                setError("Failed to place bet")
            }
            if (balls.length === 0) setGamePhase("betting")
        }
    }

    const resetGame = () => {
        setBalls([])
        setRecentLandedSlot(null)
        setWinAmount(null)
        setGamePhase("betting")
    }

    const isSending = gamePhase === "sending"

    if (!connected) {
        return (
            <div className='glass-card p-8 text-center'>
                <CircleDot className='w-12 h-12 mx-auto mb-4 text-muted-foreground' />
                <p className='text-muted-foreground'>Connect your wallet to play Plinko</p>
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
                        <GameIcon game="plinko" size="lg" showGlow={true} />
                        <h1 className='text-4xl font-bold text-white'>Plinko</h1>
                    </div>
                    <p className='text-muted-foreground'>Drop the ball and watch it bounce!</p>
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
                    {/* Plinko Board */}
                    <div className='lg:col-span-2 glass-card p-4'>
                        <canvas
                            ref={canvasRef}
                            className='w-full rounded-lg mx-auto block'
                            style={{ maxWidth: "500px" }}
                        />

                        {/* Result Display */}
                        {gamePhase === "result" && winAmount !== null && (
                            <div
                                className={`mt-4 p-4 rounded-lg text-center ${
                                    multipliers[recentLandedSlot!] >= 1
                                        ? "bg-green-500/20 border border-green-500/40"
                                        : "bg-red-500/20 border border-red-500/40"
                                }`}
                            >
                                <div className='text-3xl font-bold mb-2'>
                                    {multipliers[recentLandedSlot!] >= 1 ? (
                                        <span className='text-green-400'>+{winAmount.toFixed(4)} SOL</span>
                                    ) : (
                                        <span className='text-red-400'>{winAmount.toFixed(4)} SOL</span>
                                    )}
                                </div>
                                <p className='text-muted-foreground'>
                                    Landed on {multipliers[recentLandedSlot!]}x multiplier
                                </p>
                            </div>
                        )}
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
                                disabled={isSending}
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
                                    disabled={isSending}
                                    className='px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-primary/20 hover:border-primary/50 transition-all disabled:opacity-50'
                                >
                                    {amount}
                                </button>
                            ))}
                        </div>

                        {/* Risk Level */}
                        <div>
                            <label className='text-sm text-muted-foreground mb-2 block'>Risk Level</label>
                            <div className='grid grid-cols-3 gap-2'>
                                {(["low", "medium", "high"] as RiskLevel[]).map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => setRiskLevel(level)}
                                        disabled={isSending}
                                        className={`px-3 py-2 rounded-lg font-bold capitalize transition-all ${
                                            riskLevel === level
                                                ? level === "low"
                                                    ? "bg-green-500 text-white"
                                                    : level === "medium"
                                                    ? "bg-cyan-500 text-black"
                                                    : "bg-red-500 text-white"
                                                : "bg-white/5 text-muted-foreground hover:bg-white/10"
                                        }`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className='flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400'>
                                <AlertCircle className='w-4 h-4' />
                                <span className='text-sm'>{error}</span>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className='space-y-3'>
                            <button
                                onClick={dropBall}
                                disabled={isSending}
                                className='w-full bg-gradient-to-r from-[#7fffd4] to-[#00ff88] hover:shadow-[0_0_40px_rgba(127,255,212,0.6)] transition-all duration-300 px-6 py-4 rounded-full font-bold text-[#0a1f1c] text-lg disabled:opacity-50 relative overflow-hidden group'
                            >
                                <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700' />
                                <span className='relative flex items-center justify-center gap-2'>
                                    {isSending ? (
                                        <>
                                            <Loader2 className='w-5 h-5 animate-spin' />
                                            Placing Bet...
                                        </>
                                    ) : (
                                        <>
                                            <CircleDot className='w-5 h-5' />
                                            DROP BALL
                                        </>
                                    )}
                                </span>
                            </button>

                            {gamePhase === "result" && balls.length === 0 && (
                                <button
                                    onClick={resetGame}
                                    className='w-full bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-full font-bold transition-all'
                                >
                                    Clear Results
                                </button>
                            )}
                        </div>

                        <p className='text-xs text-center text-muted-foreground'>House Edge: 1% • {ROWS} rows</p>
                    </div>
                </div>
            </div>
        </>
    )
}
