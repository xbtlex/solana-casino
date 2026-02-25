import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { SystemProgram, Transaction } from "@solana/web3.js"
import { COMMITMENT } from "../config/solana-config"
import { HOUSE_WALLET } from "../config/game-config"
import { getBalance, solToLamports } from "../utils/solana"

interface BalanceContextType {
    // Deposited balance (for gambling)
    depositedBalance: number
    // Wallet balance (actual SOL in wallet)
    walletBalance: number
    // Actions
    deposit: (amount: number) => Promise<boolean>
    withdraw: (amount: number) => Promise<boolean>
    // For games - deduct/add from deposited balance
    placeBet: (amount: number) => boolean
    addWinnings: (amount: number) => void
    // Loading states
    isDepositing: boolean
    isWithdrawing: boolean
    error: string | null
    clearError: () => void
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined)

const STORAGE_KEY = "casino_balance"

export const BalanceProvider = ({ children }: { children: ReactNode }) => {
    const { publicKey, sendTransaction, connected } = useWallet()
    const { connection } = useConnection()

    const [depositedBalance, setDepositedBalance] = useState(0)
    const [walletBalance, setWalletBalance] = useState(0)
    const [isDepositing, setIsDepositing] = useState(false)
    const [isWithdrawing, setIsWithdrawing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Load saved balance for this wallet
    useEffect(() => {
        if (publicKey) {
            const saved = localStorage.getItem(`${STORAGE_KEY}_${publicKey.toBase58()}`)
            if (saved) {
                const parsed = parseFloat(saved)
                if (!isNaN(parsed) && parsed > 0) {
                    setDepositedBalance(parsed)
                }
            }
        } else {
            setDepositedBalance(0)
        }
    }, [publicKey])

    // Save balance to localStorage
    useEffect(() => {
        if (publicKey && depositedBalance > 0) {
            localStorage.setItem(`${STORAGE_KEY}_${publicKey.toBase58()}`, depositedBalance.toString())
        } else if (publicKey && depositedBalance === 0) {
            localStorage.removeItem(`${STORAGE_KEY}_${publicKey.toBase58()}`)
        }
    }, [depositedBalance, publicKey])

    // Fetch wallet balance
    useEffect(() => {
        if (!publicKey || !connected) {
            console.log("Wallet not connected, resetting balance to 0")
            setWalletBalance(0)
            return
        }

        console.log("Wallet connected:", publicKey.toBase58())

        const fetchWalletBalance = async () => {
            try {
                console.log("Fetching balance for:", publicKey.toBase58())
                const bal = await getBalance(connection, publicKey)
                console.log("Wallet balance fetched:", bal, "SOL")
                setWalletBalance(bal)
            } catch (err) {
                console.error("Failed to fetch wallet balance:", err)
            }
        }

        fetchWalletBalance()
        const interval = setInterval(fetchWalletBalance, 10000)
        return () => clearInterval(interval)
    }, [publicKey, connected, connection])

    const clearError = useCallback(() => setError(null), [])

    // Deposit SOL from wallet to casino balance
    const deposit = useCallback(async (amount: number): Promise<boolean> => {
        if (!publicKey || !connected) {
            setError("Wallet not connected")
            return false
        }

        if (amount <= 0) {
            setError("Invalid deposit amount")
            return false
        }

        if (amount > walletBalance) {
            setError("Insufficient wallet balance")
            return false
        }

        setIsDepositing(true)
        setError(null)

        try {
            // Send SOL to house wallet
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: HOUSE_WALLET,
                    lamports: solToLamports(amount)
                })
            )

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(COMMITMENT)
            transaction.recentBlockhash = blockhash
            transaction.feePayer = publicKey

            const signature = await sendTransaction(transaction, connection)
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, COMMITMENT)

            // Add to deposited balance
            setDepositedBalance(prev => prev + amount)
            setWalletBalance(prev => prev - amount)

            return true
        } catch (err: any) {
            if (err.message?.includes("User rejected")) {
                setError("Transaction cancelled")
            } else {
                setError("Deposit failed. Please try again.")
            }
            return false
        } finally {
            setIsDepositing(false)
        }
    }, [publicKey, connected, walletBalance, connection, sendTransaction])

    // Withdraw from casino balance back to wallet
    const withdraw = useCallback(async (amount: number): Promise<boolean> => {
        if (!publicKey || !connected) {
            setError("Wallet not connected")
            return false
        }

        if (amount <= 0) {
            setError("Invalid withdrawal amount")
            return false
        }

        if (amount > depositedBalance) {
            setError("Insufficient casino balance")
            return false
        }

        setIsWithdrawing(true)
        setError(null)

        try {
            // Note: In a real implementation, the house wallet would send SOL back
            // For demo purposes, we'll just update the balances
            // In production, this would require a backend service

            // Simulate withdrawal (deduct from deposited balance)
            setDepositedBalance(prev => prev - amount)

            // In production: await payoutService to send SOL back to user
            // For now we just show it as successful

            return true
        } catch (err: any) {
            setError("Withdrawal failed. Please try again.")
            return false
        } finally {
            setIsWithdrawing(false)
        }
    }, [publicKey, connected, depositedBalance])

    // Place a bet (deduct from deposited balance)
    const placeBet = useCallback((amount: number): boolean => {
        if (amount <= 0 || amount > depositedBalance) {
            return false
        }
        setDepositedBalance(prev => prev - amount)
        return true
    }, [depositedBalance])

    // Add winnings to deposited balance
    const addWinnings = useCallback((amount: number) => {
        if (amount > 0) {
            setDepositedBalance(prev => prev + amount)
        }
    }, [])

    return (
        <BalanceContext.Provider
            value={{
                depositedBalance,
                walletBalance,
                deposit,
                withdraw,
                placeBet,
                addWinnings,
                isDepositing,
                isWithdrawing,
                error,
                clearError
            }}
        >
            {children}
        </BalanceContext.Provider>
    )
}

export const useBalance = () => {
    const context = useContext(BalanceContext)
    if (!context) {
        throw new Error("useBalance must be used within a BalanceProvider")
    }
    return context
}
