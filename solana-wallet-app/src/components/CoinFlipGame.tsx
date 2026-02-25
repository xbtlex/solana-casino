import { useState, useEffect } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { SystemProgram, Transaction } from "@solana/web3.js"
import { getBalance, solToLamports, getExplorerUrl } from "../utils/solana"
import { validateAmount, validateBalance } from "../utils/validation"
import { TrendingDown, Loader2, AlertCircle, Trophy, ExternalLink, Clock, Hash, Shield } from "lucide-react"
import { GameIcon } from "./ui/GameIcon"
import { COMMITMENT, SOLANA_NETWORK } from "../config/solana-config"
import { HOUSE_WALLET, GAME_CONFIG } from "../config/game-config"
import { generateProvablyFairResult } from "../utils/provablyFair"
import { processPayout } from "../utils/payoutService"
import { useGameHistory } from "../hooks/useGameHistory"
import { soundEffects } from "../utils/soundEffects"
import { Confetti } from "./Confetti"

type CoinSide = "heads" | "tails"
type GameResult = "win" | "lose" | null
type GamePhase = "betting" | "sending" | "flipping" | "payout" | "result"

interface GameStats {
    wins: number
    losses: number
    totalWagered: number
    totalWon: number
}

export const CoinFlipGame = () => {
    const { publicKey, sendTransaction, connected } = useWallet()
    const { connection } = useConnection()

    const [betAmount, setBetAmount] = useState("")
    const [selectedSide, setSelectedSide] = useState<CoinSide | null>(null)
    const [gamePhase, setGamePhase] = useState<GamePhase>("betting")
    const [result, setResult] = useState<CoinSide | null>(null)
    const [gameResult, setGameResult] = useState<GameResult>(null)
    const [balance, setBalance] = useState<number>(0)
    const [error, setError] = useState<string>("")
    const [txSignature, setTxSignature] = useState<string | null>(null)
    const [payoutTxSignature, setPayoutTxSignature] = useState<string | null>(null)
    const [provablyFairData, setProvablyFairData] = useState<{ blockhash: string; slot: number } | null>(null)
    const [showConfetti, setShowConfetti] = useState(false)
    const [stats, setStats] = useState<GameStats>({
        wins: 0,
        losses: 0,
        totalWagered: 0,
        totalWon: 0
    })

    const { history, addEntry } = useGameHistory()

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

    // Reset game state on wallet change
    useEffect(() => {
        if (connected && publicKey) {
            resetGame()
        }
    }, [publicKey, connected])

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

        if (amount < GAME_CONFIG.minBet) {
            setError(`Minimum bet is ${GAME_CONFIG.minBet} SOL`)
            return false
        }

        if (amount > GAME_CONFIG.maxBet) {
            setError(`Maximum bet is ${GAME_CONFIG.maxBet} SOL`)
            return false
        }

        const balanceCheck = validateBalance(amount, balance)

        if (!balanceCheck.valid) {
            setError(balanceCheck.error || "Insufficient balance")
            return false
        }

        if (!selectedSide) {
            setError("Please select heads or tails")
            return false
        }

        return true
    }

    const flipCoin = async () => {
        if (!validateBet() || !connected || !publicKey) return

        setGamePhase("sending")
        setGameResult(null)
        setResult(null)
        setError("")
        setTxSignature(null)
        setPayoutTxSignature(null)
        setProvablyFairData(null)

        const amount = parseFloat(betAmount)

        try {
            // STEP 1: Send bet to house wallet FIRST (escrow the bet)
            console.log(`Sending ${amount} SOL to house wallet before flip...`)

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

            // Send the bet transaction
            const betSignature = await sendTransaction(betTransaction, connection)
            setTxSignature(betSignature)
            console.log("Bet transaction sent:", betSignature)

            // WAIT for confirmation before flipping
            const confirmation = await connection.confirmTransaction(
                {
                    signature: betSignature,
                    blockhash,
                    lastValidBlockHeight
                },
                COMMITMENT
            )

            if (confirmation.value.err) {
                throw new Error("Bet transaction failed")
            }

            console.log("Bet confirmed! Now flipping coin...")

            // STEP 2: Now flip the coin
            setGamePhase("flipping")
            soundEffects.playFlip()

            // Generate provably fair result using blockhash
            const fairResult = await generateProvablyFairResult(connection, 50, publicKey.toBase58())

            // Animate the flip
            await new Promise((resolve) => setTimeout(resolve, 2000))

            // The provablyFair function determines if we "won" the flip
            // We need to convert this to heads/tails based on what the user selected
            // If user wins, the result matches their choice. If they lose, it's the opposite.
            const coinResult: "heads" | "tails" = fairResult.won
                ? selectedSide!
                : selectedSide === "heads"
                ? "tails"
                : "heads"

            setResult(coinResult)
            setProvablyFairData({
                blockhash: fairResult.blockhash,
                slot: fairResult.slot
            })

            // Determine win/loss based on the fair result
            const didWin = fairResult.won
            setGameResult(didWin ? "win" : "lose")
            setGamePhase("result")

            // Play result sound
            if (didWin) {
                soundEffects.playWin()
                setShowConfetti(true)
                setTimeout(() => setShowConfetti(false), 4000)

                // STEP 3: Process payout from house wallet to player
                setGamePhase("payout")
                const payoutAmount = amount * GAME_CONFIG.winMultiplier
                console.log(`Player won! Processing payout of ${payoutAmount} SOL...`)

                try {
                    const payoutResult = await processPayout(connection, {
                        playerWallet: publicKey.toBase58(),
                        amount: payoutAmount,
                        gameId: `game_${Date.now()}`,
                        blockhash: fairResult.blockhash,
                        slot: fairResult.slot
                    })

                    if (payoutResult.success && payoutResult.signature) {
                        setPayoutTxSignature(payoutResult.signature)
                        console.log(`Payout successful! Signature: ${payoutResult.signature}`)
                    } else {
                        console.warn("Payout queued or pending:", payoutResult.error)
                        // Still show as win, but note payout is pending
                    }
                } catch (payoutError) {
                    console.error("Payout error:", payoutError)
                    // Don't fail the game, just note payout is pending
                }

                setGamePhase("result")
            } else {
                soundEffects.playLose()
                // Bet already sent to house - no further action needed for losses
                console.log("Player lost. Bet already in house wallet.")
            }

            // Update stats
            setStats((prev) => ({
                wins: prev.wins + (didWin ? 1 : 0),
                losses: prev.losses + (didWin ? 0 : 1),
                totalWagered: prev.totalWagered + amount,
                totalWon: prev.totalWon + (didWin ? amount * GAME_CONFIG.winMultiplier : 0)
            }))

            // Add to history
            addEntry({
                betAmount: amount,
                userChoice: selectedSide!,
                result: fairResult.result,
                won: didWin,
                payout: didWin ? amount * GAME_CONFIG.winMultiplier : 0,
                blockhash: fairResult.blockhash,
                slot: fairResult.slot
            })
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
        setResult(null)
        setGameResult(null)
        setSelectedSide(null)
        setBetAmount("")
        setError("")
        setTxSignature(null)
        setPayoutTxSignature(null)
        setProvablyFairData(null)
        setGamePhase("betting")
    }

    const handleSelectSide = (side: CoinSide) => {
        soundEffects.playClick()
        setSelectedSide(side)
    }

    const isProcessing = gamePhase === "sending" || gamePhase === "flipping"

    if (!connected) {
        return (
            <div className='glass-card p-8 text-center'>
                <div className='flex justify-center mb-4'>
                    <GameIcon game="coinflip" size="lg" showGlow={false} />
                </div>
                <p className='text-muted-foreground'>Connect your wallet to play Coin Flip</p>
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
                        <GameIcon game="coinflip" size="lg" showGlow={true} />
                        <h1 className='text-4xl font-bold text-white'>Coin Flip</h1>
                    </div>
                    <p className='text-muted-foreground'>Classic heads or tails - double your SOL!</p>
                </div>

                {/* Game Stats */}
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                    <div className='glass-card p-4'>
                        <div className='text-xs text-muted-foreground mb-1'>Wins</div>
                        <div className='text-2xl font-bold text-green-400 flex items-center gap-2'>
                            <Trophy className='w-5 h-5' />
                            {stats.wins}
                        </div>
                    </div>
                    <div className='glass-card p-4'>
                        <div className='text-xs text-muted-foreground mb-1'>Losses</div>
                        <div className='text-2xl font-bold text-red-400'>{stats.losses}</div>
                    </div>
                    <div className='glass-card p-4'>
                        <div className='text-xs text-muted-foreground mb-1'>Total Bet</div>
                        <div className='text-2xl font-bold text-white'>{stats.totalWagered.toFixed(2)}</div>
                    </div>
                    <div className='glass-card p-4'>
                        <div className='text-xs text-muted-foreground mb-1'>Total Won</div>
                        <div className='text-2xl font-bold text-primary'>{stats.totalWon.toFixed(2)}</div>
                    </div>
                </div>

                {/* Main Game Card */}
                <div className='glass-card p-8'>
                    {/* Security Badge */}
                    <div className='flex justify-center mb-4'>
                        <div className='inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-xs text-green-400'>
                            <Shield className='w-3 h-3' />
                            Bet Secured: SOL sent to house before flip
                        </div>
                    </div>

                    {/* Coin Display */}
                    <div className='flex justify-center mb-12'>
                        <div className={`coin-container ${gamePhase === "flipping" ? "flipping" : ""}`}>
                            <div className={`coin ${result || "heads"}`}>
                                <div className='coin-face heads'>
                                    <div className='coin-content'>
                                        <div className='coin-icon'>👑</div>
                                        <div className='coin-text font-bold'>HEADS</div>
                                    </div>
                                    <div className='coin-shine' />
                                </div>
                                <div className='coin-face tails'>
                                    <div className='coin-content'>
                                        <div className='coin-icon'>🎯</div>
                                        <div className='coin-text font-bold'>TAILS</div>
                                    </div>
                                    <div className='coin-shine' />
                                </div>
                            </div>
                            {/* Inner shadows and glows */}
                            <div className='coin-shadow' />
                        </div>
                    </div>

                    {/* Phase Status */}
                    {gamePhase === "sending" && (
                        <div className='mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center backdrop-blur-sm animate-pulse-slow'>
                            <div className='flex items-center justify-center gap-2 text-emerald-400 mb-2'>
                                <Loader2 className='w-5 h-5 animate-spin' />
                                <span className='font-bold uppercase tracking-wider text-sm'>
                                    Escrow in progress...
                                </span>
                            </div>
                            <p className='text-xs text-emerald-400/80'>
                                Securing your bet on-chain. Confirm in your wallet.
                            </p>
                        </div>
                    )}

                    {gamePhase === "flipping" && (
                        <div className='mb-6 p-4 bg-primary/10 border border-primary/30 rounded-lg text-center backdrop-blur-sm'>
                            <div className='flex items-center justify-center gap-2 text-primary mb-2'>
                                <Loader2 className='w-5 h-5 animate-spin' />
                                <span className='font-bold uppercase tracking-wider text-sm'>Verifying flip...</span>
                            </div>
                            <p className='text-xs text-primary/80 font-mono'>BLOCKHASH FETCHED • CALCULATING RESULT</p>
                        </div>
                    )}

                    {gamePhase === "payout" && (
                        <div className='mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center'>
                            <div className='flex items-center justify-center gap-2 text-green-400 mb-2'>
                                <Loader2 className='w-5 h-5 animate-spin' />
                                <span className='font-bold'>Processing payout...</span>
                            </div>
                            <p className='text-sm text-green-400/80'>
                                You won! Sending your winnings from the house wallet...
                            </p>
                        </div>
                    )}

                    {/* Result Display */}
                    {gamePhase === "result" && gameResult && (
                        <div
                            className={`mb-6 p-8 rounded-2xl text-center transform scale-105 transition-all duration-500 ${
                                gameResult === "win"
                                    ? "bg-green-500/20 border-2 border-green-500/40 shadow-[0_0_50px_rgba(34,197,94,0.3)]"
                                    : "bg-red-500/20 border-2 border-red-500/40 shadow-[0_0_50px_rgba(239,68,68,0.3)]"
                            }`}
                        >
                            <div className='flex flex-col items-center gap-2 mb-4'>
                                {gameResult === "win" ? (
                                    <Trophy className='w-12 h-12 text-emerald-400 animate-bounce' />
                                ) : (
                                    <TrendingDown className='w-12 h-12 text-red-400' />
                                )}
                                <h3
                                    className={`text-4xl font-extrabold tracking-tighter ${
                                        gameResult === "win" ? "text-green-400" : "text-red-400"
                                    }`}
                                >
                                    {gameResult === "win" ? "VICTORY!" : "DEFEAT"}
                                </h3>
                            </div>
                            <p className='text-white text-3xl font-mono font-bold mb-6'>
                                {gameResult === "win"
                                    ? `+${(parseFloat(betAmount) * GAME_CONFIG.winMultiplier).toFixed(3)} SOL`
                                    : `-${parseFloat(betAmount).toFixed(3)} SOL`}
                            </p>

                            {/* Payout Notice for Winners */}
                            {gameResult === "win" && (
                                <div className='mb-4 p-3 bg-green-500/20 rounded-lg'>
                                    {payoutTxSignature ? (
                                        <div className='space-y-2'>
                                            <p className='text-sm text-green-400'>
                                                🎉 Payout of{" "}
                                                {(parseFloat(betAmount) * GAME_CONFIG.winMultiplier).toFixed(4)} SOL
                                                sent!
                                            </p>
                                            <a
                                                href={getExplorerUrl(payoutTxSignature, SOLANA_NETWORK)}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                className='inline-flex items-center gap-2 text-sm text-green-300 hover:text-green-200 transition-colors'
                                            >
                                                View Payout Transaction
                                                <ExternalLink className='w-4 h-4' />
                                            </a>
                                        </div>
                                    ) : (
                                        <p className='text-sm text-emerald-400'>
                                            ⏳ Payout of{" "}
                                            {(parseFloat(betAmount) * GAME_CONFIG.winMultiplier).toFixed(4)} SOL is
                                            being processed...
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Provably Fair Data */}
                            {provablyFairData && (
                                <div className='text-xs text-muted-foreground space-y-1 mb-4 font-mono'>
                                    <div className='flex items-center justify-center gap-2'>
                                        <Hash className='w-3 h-3' />
                                        <span>Blockhash: {provablyFairData.blockhash.slice(0, 20)}...</span>
                                    </div>
                                    <div className='flex items-center justify-center gap-2'>
                                        <Clock className='w-3 h-3' />
                                        <span>Slot: {provablyFairData.slot}</span>
                                    </div>
                                </div>
                            )}

                            {/* Transaction Link */}
                            {txSignature && (
                                <a
                                    href={getExplorerUrl(txSignature, SOLANA_NETWORK)}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='inline-flex items-center gap-2 text-sm text-primary hover:text-accent transition-colors mb-4'
                                >
                                    View Bet Transaction
                                    <ExternalLink className='w-4 h-4' />
                                </a>
                            )}

                            <div>
                                <button
                                    onClick={resetGame}
                                    className='mt-2 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors'
                                >
                                    Play Again
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Betting Interface */}
                    {gamePhase === "betting" && (
                        <>
                            {/* Bet Amount */}
                            <div className='mb-6'>
                                <div className='flex items-center justify-between mb-2'>
                                    <label className='text-sm font-medium text-muted-foreground'>
                                        Bet Amount (SOL)
                                    </label>
                                    <span className='text-xs font-mono text-primary/80'>
                                        Available: {balance.toFixed(4)} SOL
                                    </span>
                                </div>

                                {/* Preset Buttons */}
                                <div className='grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3'>
                                    {[0.1, 0.25, 0.5, 1, 2].map((preset) => (
                                        <button
                                            key={preset}
                                            type='button'
                                            onClick={() => setBetAmount(preset.toString())}
                                            disabled={isProcessing}
                                            className='px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-primary/20 hover:border-primary/50 transition-all'
                                        >
                                            {preset} SOL
                                        </button>
                                    ))}
                                    <button
                                        type='button'
                                        onClick={() => setBetAmount(Math.max(0, balance - 0.005).toString())}
                                        disabled={isProcessing}
                                        className='px-2 py-2 bg-primary/10 border border-primary/30 rounded-lg text-xs font-bold text-primary hover:bg-primary/20 transition-all'
                                    >
                                        MAX
                                    </button>
                                </div>

                                <div className='relative'>
                                    <input
                                        type='text'
                                        value={betAmount}
                                        onChange={(e) => setBetAmount(e.target.value)}
                                        placeholder='0.00'
                                        disabled={isProcessing}
                                        className='w-full bg-white/10 border-2 border-white/5 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all font-mono text-xl'
                                    />
                                    <div className='absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none font-bold'>
                                        SOL
                                    </div>
                                </div>
                                <div className='flex justify-between mt-2 px-1'>
                                    <span className='text-[10px] text-muted-foreground uppercase tracking-widest'>
                                        Min: {GAME_CONFIG.minBet}
                                    </span>
                                    <span className='text-[10px] text-muted-foreground uppercase tracking-widest'>
                                        Max: {GAME_CONFIG.maxBet}
                                    </span>
                                </div>
                            </div>

                            {/* Heads or Tails Selection */}
                            <div className='mb-6'>
                                <label className='block text-sm font-medium text-muted-foreground mb-3'>
                                    Choose Your Side
                                </label>
                                <div className='grid grid-cols-2 gap-4'>
                                    <button
                                        onClick={() => handleSelectSide("heads")}
                                        disabled={isProcessing}
                                        className={`p-6 rounded-xl border-2 transition-all ${
                                            selectedSide === "heads"
                                                ? "border-primary bg-primary/20 shadow-[0_0_20px_rgba(127,255,212,0.5)]"
                                                : "border-white/10 bg-white/5 hover:border-primary/50"
                                        } disabled:opacity-50`}
                                    >
                                        <div className='text-4xl mb-2'>👑</div>
                                        <div className='text-xl font-bold text-white'>HEADS</div>
                                    </button>
                                    <button
                                        onClick={() => handleSelectSide("tails")}
                                        disabled={isProcessing}
                                        className={`p-6 rounded-xl border-2 transition-all ${
                                            selectedSide === "tails"
                                                ? "border-accent bg-accent/20 shadow-[0_0_20px_rgba(0,255,255,0.5)]"
                                                : "border-white/10 bg-white/5 hover:border-accent/50"
                                        } disabled:opacity-50`}
                                    >
                                        <div className='text-4xl mb-2'>🎯</div>
                                        <div className='text-xl font-bold text-white'>TAILS</div>
                                    </button>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className='mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg'>
                                    <div className='flex items-center gap-2 text-red-400'>
                                        <AlertCircle className='w-5 h-5' />
                                        <span>{error}</span>
                                    </div>
                                </div>
                            )}

                            {/* Flip Button */}
                            <button
                                onClick={flipCoin}
                                disabled={isProcessing}
                                className='w-full bg-gradient-to-r from-[#7fffd4] to-[#5cccaa] hover:shadow-[0_0_40px_rgba(127,255,212,0.6)] transition-all duration-300 px-6 py-4 rounded-full font-bold text-[#0a1f1c] text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden'
                            >
                                <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700' />

                                <div className='relative flex items-center gap-3'>
                                    <Coins className='w-6 h-6' />
                                    Flip Coin - Win {GAME_CONFIG.winMultiplier}x!
                                </div>
                            </button>

                            <p className='text-center text-sm text-muted-foreground mt-4'>
                                <span className='text-emerald-400'>⚠️</span> Your bet is sent to house wallet BEFORE the
                                flip • Win {GAME_CONFIG.winMultiplier}x • Provably Fair
                            </p>
                        </>
                    )}
                </div>

                {/* Game History */}
                {history.length > 0 && (
                    <div className='glass-card p-6'>
                        <h4 className='text-lg font-bold text-white mb-4'>Recent Games</h4>
                        <div className='space-y-2 max-h-60 overflow-y-auto'>
                            {history.slice(0, 10).map((entry) => (
                                <div
                                    key={entry.id}
                                    className={`flex items-center justify-between p-3 rounded-lg ${
                                        entry.won ? "bg-green-500/10" : "bg-red-500/10"
                                    }`}
                                >
                                    <div className='flex items-center gap-3'>
                                        <div className='text-2xl'>{entry.userChoice === "heads" ? "👑" : "🎯"}</div>
                                        <div>
                                            <div className='text-sm font-mono'>
                                                {entry.betAmount.toFixed(4)} SOL → {entry.result.toUpperCase()}
                                            </div>
                                            <div className='text-xs text-muted-foreground'>
                                                {new Date(entry.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`font-bold ${entry.won ? "text-green-400" : "text-red-400"}`}>
                                        {entry.won ? "+" : "-"}
                                        {entry.won ? entry.payout.toFixed(4) : entry.betAmount.toFixed(4)} SOL
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* How to Play */}
                <div className='glass-card p-6'>
                    <h4 className='text-lg font-bold text-white mb-3'>How to Play</h4>
                    <ul className='space-y-2 text-sm text-muted-foreground'>
                        <li className='flex items-start gap-2'>
                            <span className='text-primary'>1.</span>
                            <span>
                                Enter the amount of SOL you want to bet (min: {GAME_CONFIG.minBet}, max:{" "}
                                {GAME_CONFIG.maxBet})
                            </span>
                        </li>
                        <li className='flex items-start gap-2'>
                            <span className='text-primary'>2.</span>
                            <span>Choose Heads 👑 or Tails 🎯</span>
                        </li>
                        <li className='flex items-start gap-2'>
                            <span className='text-primary'>3.</span>
                            <span>
                                <strong className='text-emerald-400'>Confirm the transaction</strong> - Your bet is sent
                                to the house wallet FIRST
                            </span>
                        </li>
                        <li className='flex items-start gap-2'>
                            <span className='text-primary'>4.</span>
                            <span>Once confirmed, the coin flips with a provably fair result</span>
                        </li>
                        <li className='flex items-start gap-2'>
                            <span className='text-primary'>5.</span>
                            <span>Win and get {GAME_CONFIG.winMultiplier}x your bet sent back to your wallet!</span>
                        </li>
                        <li className='flex items-start gap-2'>
                            <span className='text-green-400'>✨</span>
                            <span className='font-semibold text-white'>
                                Secure: Bet is escrowed before flip - no free plays!
                            </span>
                        </li>
                    </ul>
                </div>
            </div>
        </>
    )
}
