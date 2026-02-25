import { useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useBalance } from "../context/BalanceContext"
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Loader2, AlertCircle, X, Coins } from "lucide-react"

export const BalanceManager = () => {
    const { connected } = useWallet()
    const { depositedBalance, walletBalance, deposit, withdraw, isDepositing, isWithdrawing, error, clearError } =
        useBalance()

    const [showModal, setShowModal] = useState(false)
    const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit")
    const [amount, setAmount] = useState("")
    const [localError, setLocalError] = useState("")

    const handleDeposit = async () => {
        setLocalError("")
        const amt = parseFloat(amount)
        if (isNaN(amt) || amt <= 0) {
            setLocalError("Enter a valid amount")
            return
        }
        const success = await deposit(amt)
        if (success) {
            setAmount("")
            setShowModal(false)
        }
    }

    const handleWithdraw = async () => {
        setLocalError("")
        const amt = parseFloat(amount)
        if (isNaN(amt) || amt <= 0) {
            setLocalError("Enter a valid amount")
            return
        }
        const success = await withdraw(amt)
        if (success) {
            setAmount("")
            setShowModal(false)
        }
    }

    if (!connected) return null

    return (
        <>
            {/* Balance Display Button */}
            <button
                onClick={() => setShowModal(true)}
                className='flex items-center gap-3 px-4 py-2 bg-[#1a3d37] hover:bg-[#1f4840] border border-[#1f4840] rounded-lg transition-all'
            >
                <div className='flex items-center gap-2'>
                    <Wallet className='w-4 h-4 text-[#8da99e]' />
                    <span className='font-mono text-sm text-[#8da99e]'>{walletBalance.toFixed(2)}</span>
                </div>
                <div className='w-px h-4 bg-[#1f4840]' />
                <div className='flex items-center gap-2'>
                    <Coins className='w-4 h-4 text-[#7fffd4]' />
                    <span className='font-mono font-bold text-[#7fffd4]'>{depositedBalance.toFixed(4)}</span>
                </div>
                {depositedBalance === 0 && walletBalance > 0 && (
                    <span className='text-xs text-cyan-400 animate-pulse'>Deposit!</span>
                )}
                {depositedBalance === 0 && walletBalance === 0 && (
                    <span className='text-xs text-[#8da99e]'>No funds</span>
                )}
            </button>

            {/* Modal */}
            {showModal && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
                    {/* Backdrop */}
                    <div
                        className='absolute inset-0 bg-black/70 backdrop-blur-sm'
                        onClick={() => setShowModal(false)}
                    />

                    {/* Modal Content */}
                    <div className='relative bg-[#0d2e2a] border border-[#1f4840] rounded-2xl p-6 w-full max-w-md shadow-2xl'>
                        {/* Close Button */}
                        <button
                            onClick={() => setShowModal(false)}
                            className='absolute top-4 right-4 text-[#8da99e] hover:text-white'
                        >
                            <X className='w-5 h-5' />
                        </button>

                        <h2 className='text-2xl font-bold text-white mb-6'>Casino Balance</h2>

                        {/* Balance Display */}
                        <div className='grid grid-cols-2 gap-4 mb-6'>
                            <div className='bg-[#0a1f1c] rounded-lg p-4'>
                                <div className='text-xs text-[#8da99e] mb-1'>Casino Balance</div>
                                <div className='text-xl font-bold text-[#7fffd4]'>
                                    {depositedBalance.toFixed(4)} SOL
                                </div>
                            </div>
                            <div className='bg-[#0a1f1c] rounded-lg p-4'>
                                <div className='text-xs text-[#8da99e] mb-1'>Wallet Balance</div>
                                <div className='text-xl font-bold text-white'>{walletBalance.toFixed(4)} SOL</div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className='flex gap-2 mb-6'>
                            <button
                                onClick={() => setActiveTab("deposit")}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === "deposit"
                                        ? "bg-[#7fffd4] text-[#0a1f1c]"
                                        : "bg-[#1a3d37] text-[#8da99e] hover:text-white"
                                }`}
                            >
                                <ArrowDownToLine className='w-4 h-4' />
                                Deposit
                            </button>
                            <button
                                onClick={() => setActiveTab("withdraw")}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === "withdraw"
                                        ? "bg-[#7fffd4] text-[#0a1f1c]"
                                        : "bg-[#1a3d37] text-[#8da99e] hover:text-white"
                                }`}
                            >
                                <ArrowUpFromLine className='w-4 h-4' />
                                Withdraw
                            </button>
                        </div>

                        {/* Amount Input */}
                        <div className='mb-4'>
                            <label className='text-sm text-[#8da99e] mb-2 block'>Amount (SOL)</label>
                            <div className='relative'>
                                <input
                                    type='number'
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder='0.00'
                                    step='0.01'
                                    className='w-full bg-[#0a1f1c] border-2 border-[#1f4840] rounded-xl px-4 py-4 text-white placeholder-[#8da99e] focus:outline-none focus:border-[#7fffd4] transition-all font-mono text-xl pr-16'
                                />
                                <div className='absolute right-4 top-1/2 -translate-y-1/2 text-[#8da99e] font-bold'>
                                    SOL
                                </div>
                            </div>
                        </div>

                        {/* Quick Amounts */}
                        <div className='grid grid-cols-4 gap-2 mb-4'>
                            {[0.1, 0.5, 1, 5].map((amt) => (
                                <button
                                    key={amt}
                                    onClick={() => setAmount(amt.toString())}
                                    className='px-2 py-2 bg-[#1a3d37] border border-[#1f4840] rounded-lg text-sm font-bold text-white hover:bg-[#1f4840] hover:border-[#7fffd4] transition-all'
                                >
                                    {amt}
                                </button>
                            ))}
                        </div>

                        {/* Max Button */}
                        <button
                            onClick={() => {
                                if (activeTab === "deposit") {
                                    setAmount(Math.max(0, walletBalance - 0.01).toFixed(4))
                                } else {
                                    setAmount(depositedBalance.toFixed(4))
                                }
                            }}
                            className='w-full mb-4 py-2 text-sm text-[#7fffd4] hover:underline'
                        >
                            {activeTab === "deposit"
                                ? `Max: ${Math.max(0, walletBalance - 0.01).toFixed(4)} SOL`
                                : `Max: ${depositedBalance.toFixed(4)} SOL`}
                        </button>

                        {/* Error Display */}
                        {(error || localError) && (
                            <div className='flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400'>
                                <AlertCircle className='w-4 h-4' />
                                <span className='text-sm'>{error || localError}</span>
                                <button
                                    onClick={() => {
                                        clearError()
                                        setLocalError("")
                                    }}
                                    className='ml-auto'
                                >
                                    <X className='w-4 h-4' />
                                </button>
                            </div>
                        )}

                        {/* Action Button */}
                        <button
                            onClick={activeTab === "deposit" ? handleDeposit : handleWithdraw}
                            disabled={isDepositing || isWithdrawing}
                            className='w-full bg-gradient-to-r from-[#7fffd4] to-[#5cccaa] hover:shadow-[0_0_30px_rgba(127,255,212,0.4)] transition-all duration-300 px-6 py-4 rounded-full font-bold text-[#0a1f1c] text-lg disabled:opacity-50 flex items-center justify-center gap-2'
                        >
                            {isDepositing || isWithdrawing ? (
                                <>
                                    <Loader2 className='w-5 h-5 animate-spin' />
                                    Processing...
                                </>
                            ) : activeTab === "deposit" ? (
                                <>
                                    <ArrowDownToLine className='w-5 h-5' />
                                    Deposit to Casino
                                </>
                            ) : (
                                <>
                                    <ArrowUpFromLine className='w-5 h-5' />
                                    Withdraw to Wallet
                                </>
                            )}
                        </button>

                        <p className='text-xs text-center text-[#8da99e] mt-4'>
                            {activeTab === "deposit"
                                ? "Deposit once, play all games without signing more transactions!"
                                : "Withdraw your casino balance back to your wallet."}
                        </p>
                    </div>
                </div>
            )}
        </>
    )
}
