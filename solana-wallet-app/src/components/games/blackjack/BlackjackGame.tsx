import { useState, useCallback } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { SystemProgram, Transaction } from "@solana/web3.js"
import { useBalance } from "../../../context/BalanceContext"
import { Loader2, AlertCircle, RotateCcw } from "lucide-react"
import { GameIcon } from "../../ui/GameIcon"
import { soundEffects } from "../../../utils/soundEffects"
import { Confetti } from "../../Confetti"
import { solToLamports } from "../../../utils/solana"
import { COMMITMENT } from "../../../config/solana-config"
import { HOUSE_WALLET } from "../../../config/game-config"
import { processPayout } from "../../../utils/payoutService"

type Suit = "♠" | "♥" | "♦" | "♣"
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K"
type GamePhase = "betting" | "dealing" | "playing" | "dealer" | "result"
type GameResult = "win" | "lose" | "push" | "blackjack" | null

interface Card {
    suit: Suit
    rank: Rank
    faceUp: boolean
}

interface GameStats {
    wins: number
    losses: number
    pushes: number
    blackjacks: number
    totalWagered: number
    totalWon: number
}

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"]
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]

const MIN_BET = 0.001
const MAX_BET = 5

// Create and shuffle a deck
const createDeck = (): Card[] => {
    const deck: Card[] = []
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank, faceUp: true })
        }
    }
    return shuffleDeck(deck)
}

const shuffleDeck = (deck: Card[]): Card[] => {
    const shuffled = [...deck]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
}

const getCardValue = (card: Card): number => {
    if (card.rank === "A") return 11
    if (["J", "Q", "K"].includes(card.rank)) return 10
    return parseInt(card.rank)
}

const calculateHandValue = (hand: Card[]): number => {
    let value = 0
    let aces = 0

    for (const card of hand) {
        if (!card.faceUp) continue
        const cardValue = getCardValue(card)
        if (card.rank === "A") aces++
        value += cardValue
    }

    // Convert aces from 11 to 1 if busting
    while (value > 21 && aces > 0) {
        value -= 10
        aces--
    }

    return value
}

const isBlackjack = (hand: Card[]): boolean => {
    return hand.length === 2 && calculateHandValue(hand) === 21
}

// Card Component
const CardDisplay = ({ card, index, hidden = false }: { card: Card; index: number; hidden?: boolean }) => {
    const isRed = card.suit === "♥" || card.suit === "♦"

    if (hidden || !card.faceUp) {
        return (
            <div
                className='w-20 h-28 rounded-lg bg-gradient-to-br from-blue-800 to-blue-900 border-2 border-blue-700 shadow-lg flex items-center justify-center'
                style={{ transform: `translateX(${index * -30}px)`, zIndex: index }}
            >
                <div className='text-2xl opacity-50'>🂠</div>
            </div>
        )
    }

    return (
        <div
            className={`w-20 h-28 rounded-lg bg-white border-2 border-gray-200 shadow-lg flex flex-col items-center justify-between p-2 ${
                isRed ? "text-red-600" : "text-gray-900"
            }`}
            style={{ transform: `translateX(${index * -30}px)`, zIndex: index }}
        >
            <div className='self-start text-lg font-bold leading-none'>
                {card.rank}
                <br />
                <span className='text-base'>{card.suit}</span>
            </div>
            <div className='text-3xl'>{card.suit}</div>
            <div className='self-end text-lg font-bold leading-none rotate-180'>
                {card.rank}
                <br />
                <span className='text-base'>{card.suit}</span>
            </div>
        </div>
    )
}

export const BlackjackGame = () => {
    const { connected, publicKey, sendTransaction } = useWallet()
    const { connection } = useConnection()
    const { walletBalance } = useBalance()

    const [betAmount, setBetAmount] = useState("")
    const [gamePhase, setGamePhase] = useState<GamePhase>("betting")
    const [deck, setDeck] = useState<Card[]>([])
    const [playerHand, setPlayerHand] = useState<Card[]>([])
    const [dealerHand, setDealerHand] = useState<Card[]>([])
    const [gameResult, setGameResult] = useState<GameResult>(null)
    const [error, setError] = useState<string>("")
    const [isProcessing, setIsProcessing] = useState(false)
    const [showConfetti, setShowConfetti] = useState(false)
    const [isDoubled, setIsDoubled] = useState(false)
    const [message, setMessage] = useState("")
    const [stats, setStats] = useState<GameStats>({
        wins: 0,
        losses: 0,
        pushes: 0,
        blackjacks: 0,
        totalWagered: 0,
        totalWon: 0
    })

    const handlePayout = useCallback(
        async (amount: number, result: GameResult) => {
            const totalWageredForRound = isDoubled ? amount * 2 : amount
            let payout = 0
            const playerWallet = publicKey?.toBase58()
            if (!playerWallet) return

            switch (result) {
                case "blackjack":
                    payout = amount * 2.5 // Blackjack pays 3:2 (return 1.5 profit + 1 original)
                    soundEffects.playWin()
                    setShowConfetti(true)
                    setTimeout(() => setShowConfetti(false), 4 * 1000)
                    setStats((prev) => ({
                        ...prev,
                        blackjacks: prev.blackjacks + 1,
                        wins: prev.wins + 1,
                        totalWagered: prev.totalWagered + totalWageredForRound,
                        totalWon: prev.totalWon + payout
                    }))
                    break
                case "win":
                    payout = totalWageredForRound * 2
                    soundEffects.playWin()
                    setShowConfetti(true)
                    setTimeout(() => setShowConfetti(false), 4 * 1000)
                    setStats((prev) => ({
                        ...prev,
                        wins: prev.wins + 1,
                        totalWagered: prev.totalWagered + totalWageredForRound,
                        totalWon: prev.totalWon + payout
                    }))
                    break
                case "push":
                    payout = totalWageredForRound
                    soundEffects.playClick()
                    setStats((prev) => ({
                        ...prev,
                        pushes: prev.pushes + 1,
                        totalWagered: prev.totalWagered + totalWageredForRound,
                        totalWon: prev.totalWon + payout
                    }))
                    break
                case "lose":
                    soundEffects.playLose()
                    setStats((prev) => ({
                        ...prev,
                        losses: prev.losses + 1,
                        totalWagered: prev.totalWagered + totalWageredForRound
                    }))
                    break
            }

            if (payout > 0) {
                try {
                    await processPayout(connection, {
                        playerWallet,
                        amount: payout,
                        gameId: `blackjack_${Date.now()}`,
                        blockhash: "",
                        slot: 0
                    })
                } catch (err) {
                    console.error("Payout failed:", err)
                }
            }
        },
        [publicKey, connection, isDoubled]
    )

    const deal = async () => {
        setError("")
        setMessage("")
        setGameResult(null)
        setIsDoubled(false) // Reset isDoubled for a new game

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

        if (amount > walletBalance) {
            setError("Insufficient balance")
            return
        }

        if (!publicKey) return

        setIsProcessing(true)

        try {
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

            setGamePhase("dealing")

            // Create and shuffle deck
            const newDeck = createDeck()
            let currentDeck = [...newDeck]

            // Phase 1: First card to player
            const card1 = currentDeck[0]
            currentDeck = currentDeck.slice(1)
            setPlayerHand([{ ...card1, faceUp: true }])
            soundEffects.playClick()
            await new Promise((r) => setTimeout(r, 400))

            // Phase 2: First card to dealer
            const card2 = currentDeck[0]
            currentDeck = currentDeck.slice(1)
            setDealerHand([{ ...card2, faceUp: true }])
            soundEffects.playClick()
            await new Promise((r) => setTimeout(r, 400))

            // Phase 3: Second card to player
            const card3 = currentDeck[0]
            currentDeck = currentDeck.slice(1)
            const pHand = [
                { ...card1, faceUp: true },
                { ...card3, faceUp: true }
            ]
            setPlayerHand(pHand)
            soundEffects.playClick()
            await new Promise((r) => setTimeout(r, 400))

            // Phase 4: Second card to dealer (face down)
            const card4 = currentDeck[0]
            currentDeck = currentDeck.slice(1)
            const dHand = [
                { ...card2, faceUp: true },
                { ...card4, faceUp: false }
            ]
            setDealerHand(dHand)
            setDeck(currentDeck)
            soundEffects.playClick()
            await new Promise((r) => setTimeout(r, 500))

            if (isBlackjack(pHand)) {
                const revealedDealer = dHand.map((c) => ({ ...c, faceUp: true }))
                setDealerHand(revealedDealer)
                soundEffects.playClick()

                if (isBlackjack(revealedDealer)) {
                    setGameResult("push")
                    setMessage("Both have Blackjack - Push!")
                    await handlePayout(amount, "push")
                } else {
                    setGameResult("blackjack")
                    setMessage("BLACKJACK! 🎰")
                    await handlePayout(amount, "blackjack")
                }
                setGamePhase("result")
            } else {
                setGamePhase("playing")
            }
        } catch (err: any) {
            if (err.message?.includes("User rejected")) {
                setError("Transaction cancelled")
            } else {
                setError("Failed to place bet")
                console.error(err)
            }
            setGamePhase("betting")
        } finally {
            setIsProcessing(false)
        }
    }

    const hit = async () => {
        if (gamePhase !== "playing" || deck.length === 0) return

        const newCard = deck[0]
        const newHand = [...playerHand, newCard]
        setPlayerHand(newHand)
        setDeck(deck.slice(1))
        soundEffects.playClick()

        const value = calculateHandValue(newHand)
        if (value > 21) {
            setGameResult("lose")
            setMessage(`Bust! Your hand: ${value}`)
            setGamePhase("result")
            await handlePayout(parseFloat(betAmount), "lose")
            setDealerHand((prev) => prev.map((c) => ({ ...c, faceUp: true })))
        }
    }

    const stand = async () => {
        if (gamePhase !== "playing") return

        setGamePhase("dealer")

        let currentDealerHand = dealerHand.map((c) => ({ ...c, faceUp: true }))
        setDealerHand(currentDealerHand)
        let currentDeck = [...deck]

        const dealerPlay = async () => {
            while (calculateHandValue(currentDealerHand) < 17 && currentDeck.length > 0) {
                await new Promise((resolve) => setTimeout(resolve, 500))
                const newCard = currentDeck[0]
                currentDealerHand = [...currentDealerHand, newCard]
                currentDeck = currentDeck.slice(1)
                setDealerHand([...currentDealerHand])
                setDeck([...currentDeck])
                soundEffects.playClick()
            }

            const playerValue = calculateHandValue(playerHand)
            const dealerValue = calculateHandValue(currentDealerHand)

            await new Promise((resolve) => setTimeout(resolve, 500))

            if (dealerValue > 21) {
                setGameResult("win")
                setMessage(`Dealer busts with ${dealerValue}! You win!`)
                await handlePayout(parseFloat(betAmount), "win")
            } else if (playerValue > dealerValue) {
                setGameResult("win")
                setMessage(`You win! ${playerValue} vs ${dealerValue}`)
                await handlePayout(parseFloat(betAmount), "win")
            } else if (playerValue < dealerValue) {
                setGameResult("lose")
                setMessage(`Dealer wins! ${dealerValue} vs ${playerValue}`)
                await handlePayout(parseFloat(betAmount), "lose")
            } else {
                setGameResult("push")
                setMessage(`Push! Both have ${playerValue}`)
                await handlePayout(parseFloat(betAmount), "push")
            }

            setGamePhase("result")
        }

        await dealerPlay()
    }

    const doubleDown = async () => {
        if (gamePhase !== "playing" || playerHand.length !== 2 || deck.length === 0) return

        const amount = parseFloat(betAmount)
        if (amount > walletBalance) {
            setError("Insufficient balance to double down")
            return
        }

        setIsProcessing(true)

        try {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey!,
                    toPubkey: HOUSE_WALLET,
                    lamports: solToLamports(amount)
                })
            )

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(COMMITMENT)
            transaction.recentBlockhash = blockhash
            transaction.feePayer = publicKey!

            const signature = await sendTransaction(transaction, connection)
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, COMMITMENT)

            setIsDoubled(true)
            const newCard = deck[0]
            const newHand = [...playerHand, newCard]
            setPlayerHand(newHand)
            setDeck(deck.slice(1))
            soundEffects.playClick()

            const value = calculateHandValue(newHand)
            if (value > 21) {
                setGameResult("lose")
                setMessage(`Bust! Your hand: ${value}`)
                setGamePhase("result")
                await handlePayout(amount, "lose")
                setDealerHand((prev) => prev.map((c) => ({ ...c, faceUp: true })))
            } else {
                await new Promise((resolve) => setTimeout(resolve, 500))
                setGamePhase("dealer") // Move to dealer phase
                stand() // Automatically stand after doubling
            }
        } catch (err) {
            setError("Failed to double down")
        } finally {
            setIsProcessing(false)
        }
    }

    const newGame = () => {
        setPlayerHand([])
        setDealerHand([])
        setGameResult(null)
        setMessage("")
        setError("")
        setGamePhase("betting")
    }

    const playerValue = calculateHandValue(playerHand)
    const dealerValue = calculateHandValue(dealerHand)
    const isPlaying = gamePhase === "playing"
    const canDoubleDown = isPlaying && playerHand.length === 2 && parseFloat(betAmount || "0") <= walletBalance

    if (!connected) {
        return (
            <div className='glass-card p-8 text-center'>
                <Spade className='w-12 h-12 mx-auto mb-4 text-muted-foreground' />
                <p className='text-muted-foreground'>Connect your wallet to play Blackjack</p>
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
                        <GameIcon game="blackjack" size="lg" showGlow={true} />
                        <h1 className='text-4xl font-bold text-white'>Blackjack</h1>
                    </div>
                    <p className='text-muted-foreground'>Beat the dealer to 21!</p>
                </div>

                {/* Stats */}
                <div className='grid grid-cols-3 md:grid-cols-6 gap-4'>
                    <div className='glass-card p-3'>
                        <div className='text-xs text-muted-foreground'>Wins</div>
                        <div className='text-xl font-bold text-green-400'>{stats.wins}</div>
                    </div>
                    <div className='glass-card p-3'>
                        <div className='text-xs text-muted-foreground'>Losses</div>
                        <div className='text-xl font-bold text-red-400'>{stats.losses}</div>
                    </div>
                    <div className='glass-card p-3'>
                        <div className='text-xs text-muted-foreground'>Pushes</div>
                        <div className='text-xl font-bold text-teal-400'>{stats.pushes}</div>
                    </div>
                    <div className='glass-card p-3'>
                        <div className='text-xs text-muted-foreground'>Blackjacks</div>
                        <div className='text-xl font-bold text-primary'>{stats.blackjacks}</div>
                    </div>
                    <div className='glass-card p-3'>
                        <div className='text-xs text-muted-foreground'>Wagered</div>
                        <div className='text-xl font-bold text-white'>{stats.totalWagered.toFixed(2)}</div>
                    </div>
                    <div className='glass-card p-3'>
                        <div className='text-xs text-muted-foreground'>Won</div>
                        <div className='text-xl font-bold text-accent'>{stats.totalWon.toFixed(2)}</div>
                    </div>
                </div>

                {/* Game Table */}
                <div className='glass-card p-8 bg-gradient-to-br from-green-900/50 to-green-800/50 border-green-700/30'>
                    {/* Dealer Hand */}
                    <div className='mb-12'>
                        <div className='text-center mb-4'>
                            <span className='text-sm text-green-300'>Dealer</span>
                            {dealerHand.length > 0 && (
                                <span className='ml-2 text-lg font-bold text-white'>
                                    {dealerHand.every((c) => c.faceUp) ? dealerValue : "?"}
                                </span>
                            )}
                        </div>
                        <div className='flex justify-center min-h-[112px]'>
                            {gamePhase === "dealing" && dealerHand.length === 0 ? (
                                <div className='flex items-center gap-2 text-teal-400'>
                                    <Loader2 className='w-6 h-6 animate-spin' />
                                    <span>Dealing cards...</span>
                                </div>
                            ) : (
                                <div className='flex' style={{ paddingLeft: `${(dealerHand.length - 1) * 30}px` }}>
                                    {dealerHand.map((card, i) => (
                                        <CardDisplay key={i} card={card} index={i} hidden={!card.faceUp} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Message */}
                    {message && (
                        <div
                            className={`text-center py-4 mb-8 rounded-lg text-xl font-bold ${
                                gameResult === "win" || gameResult === "blackjack"
                                    ? "bg-green-500/20 text-green-400"
                                    : gameResult === "lose"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-teal-500/20 text-teal-400"
                            }`}
                        >
                            {message}
                        </div>
                    )}

                    {/* Player Hand */}
                    <div className='mb-8'>
                        <div className='flex justify-center'>
                            <div className='flex' style={{ paddingLeft: `${(playerHand.length - 1) * 30}px` }}>
                                {playerHand.map((card, i) => (
                                    <CardDisplay key={i} card={card} index={i} />
                                ))}
                            </div>
                        </div>
                        <div className='text-center mt-4'>
                            <span className='text-sm text-green-300'>Your Hand</span>
                            {playerHand.length > 0 && (
                                <span className='ml-2 text-lg font-bold text-white'>{playerValue}</span>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {isPlaying && (
                        <div className='flex justify-center gap-4'>
                            <button
                                onClick={hit}
                                disabled={isProcessing}
                                className='px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50'
                            >
                                HIT
                            </button>
                            <button
                                onClick={stand}
                                disabled={isProcessing}
                                className='px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50'
                            >
                                STAND
                            </button>
                            {canDoubleDown && (
                                <button
                                    onClick={doubleDown}
                                    disabled={isProcessing}
                                    className='px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50'
                                >
                                    DOUBLE
                                </button>
                            )}
                        </div>
                    )}

                    {gamePhase === "dealer" && (
                        <div className='flex justify-center'>
                            <div className='flex items-center gap-2 text-teal-400'>
                                <Loader2 className='w-5 h-5 animate-spin' />
                                <span>Dealer's turn...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Betting Panel */}
                {(gamePhase === "betting" || gamePhase === "result") && (
                    <div className='glass-card p-6 space-y-4 max-w-md mx-auto'>
                        {gamePhase === "result" && (
                            <button
                                onClick={newGame}
                                className='w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors mb-4'
                            >
                                <RotateCcw className='w-4 h-4' />
                                New Game
                            </button>
                        )}

                        <div className='flex items-center justify-between'>
                            <span className='text-sm text-muted-foreground'>Bet Amount</span>
                            <span className='text-sm font-mono text-primary'>
                                Balance: {walletBalance.toFixed(4)} SOL
                            </span>
                        </div>

                        <div className='relative'>
                            <input
                                type='number'
                                value={betAmount}
                                onChange={(e) => setBetAmount(e.target.value)}
                                placeholder='0.00'
                                disabled={gamePhase !== "betting" || isProcessing}
                                step='0.001'
                                className='w-full bg-white/10 border-2 border-white/10 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all font-mono text-xl pr-16'
                            />
                            <div className='absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold'>
                                SOL
                            </div>
                        </div>

                        <div className='grid grid-cols-4 gap-2'>
                            {[0.01, 0.1, 0.5, 1].map((amount) => (
                                <button
                                    key={amount}
                                    onClick={() => setBetAmount(amount.toString())}
                                    disabled={gamePhase !== "betting" || isProcessing}
                                    className='px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-primary/20 hover:border-primary/50 transition-all disabled:opacity-50'
                                >
                                    {amount}
                                </button>
                            ))}
                        </div>

                        {error && (
                            <div className='flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400'>
                                <AlertCircle className='w-4 h-4' />
                                <span className='text-sm'>{error}</span>
                            </div>
                        )}

                        {gamePhase === "betting" && (
                            <button
                                onClick={deal}
                                disabled={isProcessing}
                                className='w-full bg-gradient-to-r from-[#7fffd4] to-[#5cccaa] hover:shadow-[0_0_40px_rgba(127,255,212,0.6)] transition-all duration-300 px-6 py-4 rounded-full font-bold text-[#0a1f1c] text-lg relative overflow-hidden group disabled:opacity-50'
                            >
                                <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700' />
                                <span className='relative flex items-center justify-center gap-2'>
                                    {isProcessing && <Loader2 className='w-5 h-5 animate-spin' />}
                                    {isProcessing ? "PROCESSING..." : "DEAL"}
                                </span>
                            </button>
                        )}

                        <div className='text-xs text-center text-muted-foreground space-y-1'>
                            <p>Blackjack pays 2.5x • Win pays 2x • Push returns bet</p>
                            <p>House Edge: 0.5%</p>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
