import { Link, useLocation } from "react-router-dom"
import { WalletConnectButton } from "../WalletConnectButton"
import { useState } from "react"
import { Dices, TrendingUp, LayoutGrid, Columns3, CircleDollarSign, Target, Menu, X, Wallet } from "lucide-react"
import { IconContainer } from "../shared/IconContainer"
import { useBalance } from "../../context/BalanceContext"
import { useWallet } from "@solana/wallet-adapter-react"

const GAMES = [
    { path: "/coinflip", name: "Coin Flip", icon: CircleDollarSign },
    { path: "/dice", name: "Dice", icon: Dices },
    { path: "/crash", name: "Crash", icon: TrendingUp },
    { path: "/plinko", name: "Plinko", icon: LayoutGrid },
    { path: "/slots", name: "Slots", icon: Columns3 },
    { path: "/roulette", name: "Roulette", icon: Target }
]

export const Header = () => {
    const location = useLocation()
    const { walletBalance } = useBalance()
    const { connected } = useWallet()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <header className='sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-white/10'>
            <div className='container mx-auto px-4'>
                <div className='flex items-center justify-between h-16'>
                    {/* Logo */}
                    <Link to='/' className='flex items-center gap-3'>
                        <div className='bg-gradient-to-br from-[#7fffd4] to-[#5cccaa] p-2 rounded-xl shadow-[0_0_20px_rgba(127,255,212,0.5)]'>
                            <Dices className='w-6 h-6 text-white' />
                        </div>
                        <span className='text-xl font-bold text-white hidden sm:block'>Solana Casino</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className='hidden lg:flex items-center gap-1'>
                        {GAMES.map((game) => {
                            const Icon = game.icon
                            const isActive = location.pathname === game.path
                            return (
                                <Link
                                    key={game.path}
                                    to={game.path}
                                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                                        isActive
                                            ? "bg-primary/10 text-primary border border-primary/20"
                                            : "text-muted-foreground hover:text-white hover:bg-white/5"
                                    }`}
                                >
                                    <IconContainer
                                        icon={Icon}
                                        className='w-8 h-8'
                                        iconClassName='w-4 h-4'
                                        animatePulse={isActive}
                                    />
                                    <span className='text-sm font-medium'>{game.name}</span>
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Right side - Wallet & Balance */}
                    <div className='flex items-center gap-3'>
                        {connected && (
                            <div className='hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg'>
                                <Wallet className='w-4 h-4 text-primary' />
                                <span className='text-sm font-mono font-bold text-white'>
                                    {walletBalance.toFixed(4)} SOL
                                </span>
                            </div>
                        )}
                        <WalletConnectButton />

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className='lg:hidden p-2 text-white hover:bg-white/10 rounded-lg'
                        >
                            {mobileMenuOpen ? <X className='w-6 h-6' /> : <Menu className='w-6 h-6' />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <nav className='lg:hidden py-4 border-t border-white/10'>
                        <div className='grid grid-cols-2 gap-2'>
                            {GAMES.map((game) => {
                                const Icon = game.icon
                                const isActive = location.pathname === game.path
                                return (
                                    <Link
                                        key={game.path}
                                        to={game.path}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-2 px-3 py-3 rounded-lg transition-all ${
                                            isActive
                                                ? "bg-primary/20 text-white border border-primary/50"
                                                : "text-muted-foreground hover:text-white bg-white/5"
                                        }`}
                                    >
                                        <Icon className='w-4 h-4' />
                                        <span className='text-sm font-medium'>{game.name}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    </nav>
                )}
            </div>
        </header>
    )
}
