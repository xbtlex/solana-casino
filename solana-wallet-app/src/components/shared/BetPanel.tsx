import { useState, useEffect } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { getBalance } from "../../utils/solana"
import { AlertCircle } from "lucide-react"

interface BetPanelProps {
    onBet: (amount: number) => void
    disabled?: boolean
    minBet?: number
    maxBet?: number
    multiplier?: number
    winChance?: number
    buttonText?: string
    showPotentialWin?: boolean
}

export const BetPanel = ({
    onBet,
    disabled = false,
    minBet = 0.001,
    maxBet = 10,
    multiplier,
    winChance,
    buttonText = "Place Bet",
    showPotentialWin = true
}: BetPanelProps) => {
    const { publicKey, connected } = useWallet()
    const { connection } = useConnection()
    const [betAmount, setBetAmount] = useState("")
    const [balance, setBalance] = useState<number>(0)
    const [error, setError] = useState("")

    const quickAmounts = [0.01, 0.1, 0.5, 1, 5]

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

    const handleBet = () => {
        setError("")
        const amount = parseFloat(betAmount)

        if (!betAmount.trim() || isNaN(amount)) {
            setError("Please enter a bet amount")
            return
        }

        if (amount < minBet) {
            setError(`Minimum bet is ${minBet} SOL`)
            return
        }

        if (amount > maxBet) {
            setError(`Maximum bet is ${maxBet} SOL`)
            return
        }

        if (amount > balance) {
            setError("Insufficient balance")
            return
        }

        onBet(amount)
    }

    const handleHalf = () => {
        const current = parseFloat(betAmount) || 0
        setBetAmount((current / 2).toFixed(4))
    }

    const handleDouble = () => {
        const current = parseFloat(betAmount) || minBet
        const doubled = Math.min(current * 2, balance, maxBet)
        setBetAmount(doubled.toFixed(4))
    }

    const potentialWin = multiplier && betAmount ? parseFloat(betAmount) * multiplier : 0

    return (
        <div className="glass-card p-6 space-y-4">
            {/* Balance Display */}
            <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bet Amount</span>
                <span className="text-sm font-mono text-primary">
                    Balance: {balance.toFixed(4)} SOL
                </span>
            </div>

            {/* Input with SOL label */}
            <div className="relative">
                <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={disabled}
                    step="0.001"
                    className="w-full bg-white/10 border-2 border-white/10 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all font-mono text-xl pr-16"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                    SOL
                </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-7 gap-2">
                {quickAmounts.map((amount) => (
                    <button
                        key={amount}
                        onClick={() => setBetAmount(amount.toString())}
                        disabled={disabled}
                        className="px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-primary/20 hover:border-primary/50 transition-all disabled:opacity-50"
                    >
                        {amount}
                    </button>
                ))}
                <button
                    onClick={handleHalf}
                    disabled={disabled}
                    className="px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-primary/20 hover:border-primary/50 transition-all disabled:opacity-50"
                >
                    ½
                </button>
                <button
                    onClick={handleDouble}
                    disabled={disabled}
                    className="px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-primary/20 hover:border-primary/50 transition-all disabled:opacity-50"
                >
                    2x
                </button>
            </div>

            {/* Min/Max Labels */}
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>Min: {minBet} SOL</span>
                <span>Max: {maxBet} SOL</span>
            </div>

            {/* Stats */}
            {(multiplier || winChance !== undefined) && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg">
                    {multiplier && (
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Multiplier</div>
                            <div className="text-lg font-bold text-primary">{multiplier.toFixed(2)}x</div>
                        </div>
                    )}
                    {winChance !== undefined && (
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Win Chance</div>
                            <div className="text-lg font-bold text-accent">{winChance.toFixed(2)}%</div>
                        </div>
                    )}
                </div>
            )}

            {/* Potential Win */}
            {showPotentialWin && multiplier && potentialWin > 0 && (
                <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <span className="text-sm text-green-400">Potential Win</span>
                    <span className="text-lg font-bold text-green-400">
                        {potentialWin.toFixed(4)} SOL
                    </span>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Bet Button */}
            <button
                onClick={handleBet}
                disabled={disabled || !connected}
                className="w-full bg-gradient-to-r from-[#7fffd4] to-[#5cccaa] hover:shadow-[0_0_40px_rgba(127,255,212,0.6)] transition-all duration-300 px-6 py-4 rounded-full font-bold text-[#0a1f1c] text-lg disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                <span className="relative">{disabled ? "Processing..." : buttonText}</span>
            </button>

            {!connected && (
                <p className="text-center text-sm text-muted-foreground">
                    Connect your wallet to play
                </p>
            )}
        </div>
    )
}
