import { Clock, TrendingUp, TrendingDown } from "lucide-react"

interface HistoryEntry {
    id: string
    timestamp: number
    betAmount: number
    won: boolean
    payout: number
    result: string
}

interface GameHistoryProps {
    history: HistoryEntry[]
    maxEntries?: number
    emptyMessage?: string
}

export const GameHistory = ({
    history,
    maxEntries = 10,
    emptyMessage = "No games played yet"
}: GameHistoryProps) => {
    if (history.length === 0) {
        return (
            <div className="glass-card p-6 text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">{emptyMessage}</p>
            </div>
        )
    }

    return (
        <div className="glass-card p-6">
            <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Recent Games
            </h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
                {history.slice(0, maxEntries).map((entry) => (
                    <div
                        key={entry.id}
                        className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                            entry.won
                                ? "bg-green-500/10 border border-green-500/20"
                                : "bg-red-500/10 border border-red-500/20"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            {entry.won ? (
                                <TrendingUp className="w-5 h-5 text-green-400" />
                            ) : (
                                <TrendingDown className="w-5 h-5 text-red-400" />
                            )}
                            <div>
                                <div className="text-sm font-mono text-white">
                                    {entry.betAmount.toFixed(4)} SOL
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {entry.result} • {new Date(entry.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                        <div
                            className={`font-bold font-mono ${
                                entry.won ? "text-green-400" : "text-red-400"
                            }`}
                        >
                            {entry.won ? "+" : "-"}
                            {entry.won ? entry.payout.toFixed(4) : entry.betAmount.toFixed(4)} SOL
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
