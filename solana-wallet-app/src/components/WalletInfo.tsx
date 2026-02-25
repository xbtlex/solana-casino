import { useEffect, useState } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { getBalance, truncateAddress } from "../utils/solana"
import { SOLANA_NETWORK } from "../config/solana-config"
import { Copy, CheckCircle2, Wallet2, Network, Coins } from "lucide-react"

export const WalletInfo = () => {
    const { publicKey, connected } = useWallet()
    const { connection } = useConnection()
    const [balance, setBalance] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (!publicKey || !connected) {
            setBalance(null)
            return
        }

        const fetchBalance = async () => {
            setLoading(true)
            console.log("Fetching balance for:", publicKey.toBase58(), "on", connection.rpcEndpoint)
            try {
                const bal = await getBalance(connection, publicKey)
                console.log("Balance successfully fetched:", bal)
                setBalance(bal)
            } catch (error) {
                console.error("Failed to fetch balance:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchBalance()

        // Refresh balance every 10 seconds
        const interval = setInterval(fetchBalance, 10000)

        return () => clearInterval(interval)
    }, [publicKey, connected, connection])

    const handleCopyAddress = async () => {
        if (publicKey) {
            await navigator.clipboard.writeText(publicKey.toBase58())
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    if (!connected || !publicKey) {
        return null
    }

    return (
        <div className='glass-card p-6 space-y-6'>
            {/* Wallet Address */}
            <div className='space-y-2'>
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Wallet2 className='w-4 h-4' />
                    <span className='font-medium'>Wallet Address</span>
                </div>
                <div className='flex items-center gap-3'>
                    <code className='flex-1 text-white font-mono text-sm bg-white/5 px-4 py-3 rounded-lg border border-white/10'>
                        {truncateAddress(publicKey.toBase58(), 8, 8)}
                    </code>
                    <button
                        onClick={handleCopyAddress}
                        className='p-3 hover:bg-white/10 rounded-lg transition-colors border border-white/10 hover:border-primary/50 group'
                        title='Copy address'
                    >
                        {copied ? (
                            <CheckCircle2 className='w-5 h-5 text-green-400' />
                        ) : (
                            <Copy className='w-5 h-5 text-gray-400 group-hover:text-white transition-colors' />
                        )}
                    </button>
                </div>
            </div>

            {/* Balance and Network */}
            <div className='flex flex-col sm:flex-row gap-4'>
                {/* Balance */}
                <div className='flex-1 space-y-2'>
                    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <Coins className='w-4 h-4' />
                        <span className='font-medium'>Balance</span>
                    </div>
                    <div className='bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 rounded-lg px-4 py-4 min-h-[80px] flex flex-col justify-center'>
                        {loading ? (
                            <div className='text-lg font-bold text-white/50 animate-pulse'>Loading...</div>
                        ) : (
                            <div className='flex items-baseline gap-2'>
                                <span className='text-2xl font-bold text-white text-glow leading-none'>
                                    {balance !== null ? balance.toFixed(4) : "0.0000"}
                                </span>
                                <span className='text-xs font-bold text-primary/80'>SOL</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Network */}
                <div className='flex-1 space-y-2'>
                    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <Network className='w-4 h-4' />
                        <span className='font-medium'>Network</span>
                    </div>
                    <div className='bg-white/5 border border-white/10 rounded-lg px-4 py-4 min-h-[80px] flex flex-col justify-center'>
                        <div className='flex items-center gap-2'>
                            <div
                                className={`w-2 h-2 rounded-full ${
                                    SOLANA_NETWORK === "mainnet-beta" ? "bg-green-400" : "bg-cyan-400"
                                } animate-pulse`}
                            />
                            <span className='text-sm font-bold text-white uppercase tracking-widest'>
                                {SOLANA_NETWORK === "mainnet-beta" ? "Mainnet Beta" : SOLANA_NETWORK}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
