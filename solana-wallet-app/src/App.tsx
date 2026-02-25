import { BrowserRouter, Routes, Route } from "react-router-dom"
import { WalletConnectionProvider } from "./components/WalletConnectionProvider"
import { BalanceProvider } from "./context/BalanceContext"
import { Layout } from "./components/layout/Layout"
import { Home } from "./pages/Home"
import { CoinFlipGame } from "./components/CoinFlipGame"
import { DiceGame } from "./components/games/dice/DiceGame"
import { CrashGame } from "./components/games/crash/CrashGame"
import { PlinkoGame } from "./components/games/plinko/PlinkoGame"
import { SlotsGame } from "./components/games/slots/SlotsGame"
import { BlackjackGame } from "./components/games/blackjack/BlackjackGame"
import { RouletteGame } from "./components/games/roulette/RouletteGame"

function App() {
    return (
        <WalletConnectionProvider>
            <BalanceProvider>
                <BrowserRouter>
                <Layout>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/coinflip" element={<CoinFlipGame />} />
                        <Route path="/dice" element={<DiceGame />} />
                        <Route path="/crash" element={<CrashGame />} />
                        <Route path="/plinko" element={<PlinkoGame />} />
                        <Route path="/slots" element={<SlotsGame />} />
                        <Route path="/blackjack" element={<BlackjackGame />} />
                        <Route path="/roulette" element={<RouletteGame />} />
                    </Routes>
                </Layout>
                </BrowserRouter>
            </BalanceProvider>
        </WalletConnectionProvider>
    )
}

export default App
