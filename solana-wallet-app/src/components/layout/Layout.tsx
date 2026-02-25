import type { ReactNode } from "react"
import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { WalletConnectButton } from "../WalletConnectButton"
import { useBalance } from "../../context/BalanceContext"
import { useWallet } from "@solana/wallet-adapter-react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Dices, Menu, ChevronLeft, Wallet, Zap, Users, Trophy, ExternalLink
} from "lucide-react"
import { GameIcon, GAME_ICONS } from "../ui/GameIcon"

interface LayoutProps {
    children: ReactNode
}

const GAMES = [
    { path: "/coinflip", name: "Coin Flip", game: "coinflip", shortName: "Flip" },
    { path: "/dice", name: "Dice", game: "dice", shortName: "Dice" },
    { path: "/crash", name: "Crash", game: "crash", shortName: "Crash" },
    { path: "/plinko", name: "Plinko", game: "plinko", shortName: "Plinko" },
    { path: "/slots", name: "Slots", game: "slots", shortName: "Slots" },
    { path: "/blackjack", name: "Blackjack", game: "blackjack", shortName: "BJ" },
    { path: "/roulette", name: "Roulette", game: "roulette", shortName: "Roulette" }
]

// Simulated live wins data
const generateLiveWin = () => {
    const games = ["Crash", "Dice", "Coin Flip", "Slots", "Plinko", "Blackjack", "Roulette"]
    const multipliers = [1.5, 2.0, 2.5, 3.0, 5.0, 10.0, 15.0, 25.0, 50.0]
    const amounts = [0.1, 0.25, 0.5, 1.0, 2.0, 5.0]

    return {
        id: Date.now() + Math.random(),
        game: games[Math.floor(Math.random() * games.length)],
        multiplier: multipliers[Math.floor(Math.random() * multipliers.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        wallet: `${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date()
    }
}

export const Layout = ({ children }: LayoutProps) => {
    const location = useLocation()
    const { walletBalance } = useBalance()
    const { connected } = useWallet()
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [liveWins, setLiveWins] = useState(() =>
        Array.from({ length: 5 }, generateLiveWin)
    )

    // Simulate live wins feed
    useEffect(() => {
        const interval = setInterval(() => {
            setLiveWins(prev => [generateLiveWin(), ...prev.slice(0, 7)])
        }, 3000 + Math.random() * 4000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="min-h-screen bg-[#050505] relative overflow-hidden">
            {/* Background Effects - More subtle, depth-focused */}
            <div className="fixed inset-0 pointer-events-none">
                {/* Ambient glow from top-left */}
                <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-[#7fffd4]/5 rounded-full blur-[120px]" />
                {/* Ambient glow from bottom-right */}
                <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] bg-[#00ff88]/5 rounded-full blur-[100px]" />
                {/* Grid overlay */}
                <div
                    className="absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: `
                            linear-gradient(rgba(127, 255, 212, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(127, 255, 212, 0.1) 1px, transparent 1px)
                        `,
                        backgroundSize: '50px 50px'
                    }}
                />
            </div>

            {/* Mobile Header */}
            <header className="lg:hidden sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center justify-between px-4 h-14">
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#7fffd4] to-[#5cccaa] rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(127,255,212,0.3)]">
                            <Dices className="w-4 h-4 text-black" />
                        </div>
                        <span className="font-bold text-white">Solana Casino</span>
                    </Link>

                    <WalletConnectButton />
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.nav
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/5 overflow-hidden"
                        >
                            <div className="p-4 grid grid-cols-2 gap-2">
                                {GAMES.map((gameItem) => {
                                    const isActive = location.pathname === gameItem.path
                                    return (
                                        <Link
                                            key={gameItem.path}
                                            to={gameItem.path}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={`flex items-center gap-2 px-3 py-3 rounded-lg transition-all ${
                                                isActive
                                                    ? "bg-[#7fffd4]/10 text-[#7fffd4] border border-[#7fffd4]/30"
                                                    : "text-white/50 bg-white/3 hover:bg-white/5 hover:text-white"
                                            }`}
                                        >
                                            <GameIcon game={gameItem.game} size="sm" showGlow={isActive} />
                                            <span className="text-sm font-medium">{gameItem.name}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        </motion.nav>
                    )}
                </AnimatePresence>
            </header>

            <div className="flex min-h-screen lg:min-h-screen">
                {/* Sidebar - Desktop */}
                <motion.aside
                    initial={false}
                    animate={{ width: sidebarCollapsed ? 64 : 240 }}
                    className="hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-[#0a0a0a]/95 backdrop-blur-xl border-r border-white/5 z-40"
                >
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-white/5">
                        <div className="flex items-center justify-between">
                            <Link to="/" className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#7fffd4] to-[#5cccaa] rounded-xl flex items-center justify-center shadow-[0_0_25px_rgba(127,255,212,0.4)]">
                                    <Dices className="w-5 h-5 text-black" />
                                </div>
                                <AnimatePresence>
                                    {!sidebarCollapsed && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="font-bold text-lg text-white whitespace-nowrap"
                                        >
                                            Solana Casino
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </Link>
                            <button
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Balance Display */}
                    {connected && (
                        <div className="px-3 py-3 mx-2 mt-3 bg-white/3 rounded-lg border border-white/5">
                            <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-[#7fffd4]" />
                                {!sidebarCollapsed && (
                                    <div className="flex-1">
                                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Balance</p>
                                        <p className="font-mono font-bold text-white text-sm">{walletBalance.toFixed(4)} SOL</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Games Navigation */}
                    <nav className="flex-1 py-4 overflow-y-auto">
                        <div className="px-3 mb-2">
                            {!sidebarCollapsed && (
                                <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold px-2">Games</p>
                            )}
                        </div>
                        <div className="space-y-1 px-2">
                            {GAMES.map((gameItem) => {
                                const isActive = location.pathname === gameItem.path
                                return (
                                    <Link
                                        key={gameItem.path}
                                        to={gameItem.path}
                                        className={`sidebar-item ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                                        title={sidebarCollapsed ? gameItem.name : undefined}
                                    >
                                        <GameIcon
                                            game={gameItem.game}
                                            size="sm"
                                            showGlow={isActive}
                                            className={isActive ? 'border-[#7fffd4]/30' : ''}
                                        />
                                        <AnimatePresence>
                                            {!sidebarCollapsed && (
                                                <motion.span
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="text-sm font-medium"
                                                >
                                                    {gameItem.name}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </Link>
                                )
                            })}
                        </div>
                    </nav>

                    {/* Live Wins Feed */}
                    {!sidebarCollapsed && (
                        <div className="border-t border-white/5 p-3">
                            <div className="flex items-center gap-2 mb-3 px-2">
                                <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse shadow-[0_0_8px_rgba(0,255,136,0.5)]" />
                                <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Live Wins</span>
                            </div>
                            <div className="live-ticker max-h-[200px] overflow-y-auto">
                                {liveWins.slice(0, 5).map((win, index) => (
                                    <motion.div
                                        key={win.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="ticker-item"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-white/40 font-mono">{win.wallet}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-mono text-[#00ff88] font-bold">
                                                +{(win.amount * win.multiplier).toFixed(2)}
                                            </p>
                                            <p className="text-[9px] text-white/30">{win.game} • {win.multiplier}x</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Wallet Connect */}
                    <div className="p-3 border-t border-white/5">
                        <WalletConnectButton />
                    </div>
                </motion.aside>

                {/* Main Content */}
                <main
                    className={`flex-1 relative z-10 transition-all duration-300 ${
                        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'
                    }`}
                >
                    {/* Top Stats Bar - Desktop */}
                    <div className="hidden lg:flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#050505]/80 backdrop-blur-sm sticky top-0 z-30">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-white/30" />
                                <span className="text-xs text-white/50">
                                    <span className="text-[#7fffd4] font-mono font-bold">247</span> online
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-white/30" />
                                <span className="text-xs text-white/50">
                                    <span className="text-[#00ff88] font-mono font-bold">1,284</span> bets today
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-white/30" />
                                <span className="text-xs text-white/50">
                                    <span className="text-[#ffc107] font-mono font-bold">45.2 SOL</span> won today
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <a
                                href="#"
                                className="flex items-center gap-1 text-xs text-white/40 hover:text-[#7fffd4] transition-colors"
                            >
                                <span>Docs</span>
                                <ExternalLink className="w-3 h-3" />
                            </a>
                            <span className="text-white/10">|</span>
                            <span className="text-[10px] text-white/30 font-mono">v2.0.0</span>
                        </div>
                    </div>

                    {/* Page Content */}
                    <div className="p-4 lg:p-6">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {children}
                        </motion.div>
                    </div>

                    {/* Footer */}
                    <footer className="border-t border-white/5 mt-8">
                        <div className="px-6 py-6">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <p className="text-xs text-white/30">
                                        Built on <span className="text-[#7fffd4] font-semibold">Solana</span>
                                    </p>
                                    <span className="text-white/10">•</span>
                                    <p className="text-xs text-white/30">Provably Fair</p>
                                </div>
                                <p className="text-[10px] text-white/20">
                                    Play responsibly. 18+ only. Gambling can be addictive.
                                </p>
                            </div>
                        </div>
                    </footer>
                </main>
            </div>
        </div>
    )
}
