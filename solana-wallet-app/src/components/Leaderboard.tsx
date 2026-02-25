import { useLeaderboard } from '../hooks/useLeaderboard';
import { Trophy, TrendingUp, Target, Award } from 'lucide-react';
import { truncateAddress } from '../utils/solana';
import { useState } from 'react';

export const Leaderboard = () => {
  const { leaderboard, getTopPlayers, getBiggestWins } = useLeaderboard();
  const [view, setView] = useState<'totalWon' | 'biggestWin'>('totalWon');

  const displayData = view === 'totalWon' ? getTopPlayers(10) : getBiggestWins(10);

  if (leaderboard.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">
          No players yet. Be the first to play!
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          Leaderboard
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setView('totalWon')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === 'totalWon'
                ? 'bg-primary text-white'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-1" />
            Top Winners
          </button>
          <button
            onClick={() => setView('biggestWin')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === 'biggestWin'
                ? 'bg-accent text-white'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            <Award className="w-4 h-4 inline mr-1" />
            Biggest Wins
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {displayData.map((entry, index) => (
          <div
            key={entry.address}
            className={`flex items-center justify-between p-4 rounded-lg transition-all ${
              index < 3
                ? 'bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className="w-8 text-center">
                {index === 0 && <span className="text-2xl">🥇</span>}
                {index === 1 && <span className="text-2xl">🥈</span>}
                {index === 2 && <span className="text-2xl">🥉</span>}
                {index > 2 && (
                  <span className="text-lg font-bold text-muted-foreground">
                    #{index + 1}
                  </span>
                )}
              </div>

              {/* Player Info */}
              <div>
                <div className="font-mono text-sm text-white">
                  {truncateAddress(entry.address, 6, 4)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    {entry.wins}W / {entry.losses}L
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {entry.winRate.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="text-right">
              <div className="text-lg font-bold text-primary">
                {view === 'totalWon'
                  ? `${entry.totalWon.toFixed(4)} SOL`
                  : `${entry.biggestWin.toFixed(4)} SOL`}
              </div>
              <div className="text-xs text-muted-foreground">
                {view === 'totalWon' ? 'Total Won' : 'Biggest Win'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
