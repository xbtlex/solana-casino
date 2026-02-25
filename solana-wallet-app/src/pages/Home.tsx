import { Link } from "react-router-dom"
import {
    ArrowRight,
    Shield,
    Zap,
    Trophy
} from "lucide-react"
import { GameIcon } from "../components/ui/GameIcon"

const GAMES = [
    {
        path: "/coinflip",
        name: "Coin Flip",
        game: "coinflip",
        description: "Classic heads or tails - double your SOL!",
        houseEdge: "0%",
        multiplier: "2x"
    },
    {
        path: "/dice",
        name: "Dice",
        game: "dice",
        description: "Roll over or under your target number",
        houseEdge: "1%",
        multiplier: "1.01x - 99x"
    },
    {
        path: "/crash",
        name: "Crash",
        game: "crash",
        description: "Cash out before the multiplier crashes!",
        houseEdge: "1%",
        multiplier: "1x - 1000x+"
    },
    {
        path: "/plinko",
        name: "Plinko",
        game: "plinko",
        description: "Drop the ball and watch it bounce to riches",
        houseEdge: "1%",
        multiplier: "0.2x - 1000x"
    },
    {
        path: "/slots",
        name: "Slots",
        game: "slots",
        description: "Spin the reels and hit the jackpot!",
        houseEdge: "2%",
        multiplier: "Up to 500x + Jackpot"
    },
    {
        path: "/roulette",
        name: "Roulette",
        game: "roulette",
        description: "Place your bets and spin the wheel",
        houseEdge: "2.7%",
        multiplier: "2x - 36x"
    }
]

const FEATURES = [
    {
        icon: Shield,
        title: "Provably Fair",
        description: "All games use Solana blockhash for verifiable randomness"
    },
    {
        icon: Zap,
        title: "Instant Payouts",
        description: "Win and receive your SOL within seconds"
    },
    {
        icon: Trophy,
        title: "Big Wins",
        description: "Multipliers up to 1000x on some games"
    }
]

export const Home = () => {
    return (
        <div className='space-y-12'>
            {/* Hero Section */}
            <section className='text-center py-12'>
                <h1 className='text-5xl md:text-7xl font-bold text-white mb-6'>
                    <span className='bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent'>
                        Solana Casino
                    </span>
                </h1>
                <p className='text-xl text-muted-foreground max-w-2xl mx-auto mb-8'>
                    The ultimate provably fair casino on Solana. Fast transactions, instant payouts, and verifiable
                    results.
                </p>
                <div className='flex flex-wrap justify-center gap-4'>
                    {FEATURES.map((feature) => {
                        const Icon = feature.icon
                        return (
                            <div
                                key={feature.title}
                                className='flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10'
                            >
                                <Icon className='w-4 h-4 text-primary' />
                                <span className='text-sm text-white'>{feature.title}</span>
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* Games Grid */}
            <section>
                <h2 className='text-3xl font-bold text-white mb-8 text-center'>Choose Your Game</h2>
                <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
                    {GAMES.map((gameItem) => {
                        return (
                            <Link
                                key={gameItem.path}
                                to={gameItem.path}
                                className='group glass-card p-6 hover:scale-[1.02] transition-all duration-300 hover:shadow-[0_0_40px_rgba(127,255,212,0.2)] hover:border-[#7fffd4]/20'
                            >
                                <div className='mb-6'>
                                    <GameIcon
                                        game={gameItem.game}
                                        size="lg"
                                        showGlow={true}
                                        className="group-hover:scale-110 transition-transform duration-300"
                                    />
                                </div>
                                <h3 className='text-xl font-bold text-white mb-2'>{gameItem.name}</h3>
                                <p className='text-sm text-muted-foreground mb-4'>{gameItem.description}</p>
                                <div className='flex items-center justify-between'>
                                    <div className='space-y-1'>
                                        <div className='text-xs text-muted-foreground'>House Edge</div>
                                        <div className='text-sm font-mono font-semibold text-green-400'>{gameItem.houseEdge}</div>
                                    </div>
                                    <div className='space-y-1 text-right'>
                                        <div className='text-xs text-muted-foreground'>Multiplier</div>
                                        <div className='text-sm font-mono font-semibold text-primary'>{gameItem.multiplier}</div>
                                    </div>
                                </div>
                                <div className='mt-4 flex items-center justify-center gap-2 text-primary group-hover:gap-3 transition-all'>
                                    <span className='text-sm font-medium'>Play Now</span>
                                    <ArrowRight className='w-4 h-4' />
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </section>

            {/* Features Section */}
            <section className='glass-card p-8'>
                <h2 className='text-2xl font-bold text-white mb-6 text-center'>Why Play With Us?</h2>
                <div className='grid md:grid-cols-3 gap-8'>
                    {FEATURES.map((feature) => {
                        const Icon = feature.icon
                        return (
                            <div key={feature.title} className='text-center'>
                                <div className='w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4'>
                                    <Icon className='w-8 h-8 text-primary' />
                                </div>
                                <h3 className='text-lg font-bold text-white mb-2'>{feature.title}</h3>
                                <p className='text-sm text-muted-foreground'>{feature.description}</p>
                            </div>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}
