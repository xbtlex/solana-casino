import { useState, useEffect } from 'react';

export interface LeaderboardEntry {
  address: string;
  totalWon: number;
  totalWagered: number;
  wins: number;
  losses: number;
  biggestWin: number;
  winRate: number;
  lastPlayed: number;
}

const STORAGE_KEY = 'coinflip_leaderboard';
const MAX_ENTRIES = 100;

export const useLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Load leaderboard from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLeaderboard(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  }, []);

  const updateEntry = (
    address: string,
    betAmount: number,
    won: boolean,
    payout: number
  ) => {
    setLeaderboard((prev) => {
      const existing = prev.find((e) => e.address === address);

      const newEntry: LeaderboardEntry = existing
        ? {
            ...existing,
            totalWon: existing.totalWon + (won ? payout : 0),
            totalWagered: existing.totalWagered + betAmount,
            wins: existing.wins + (won ? 1 : 0),
            losses: existing.losses + (won ? 0 : 1),
            biggestWin: Math.max(existing.biggestWin, won ? payout : 0),
            winRate: ((existing.wins + (won ? 1 : 0)) / (existing.wins + existing.losses + 1)) * 100,
            lastPlayed: Date.now(),
          }
        : {
            address,
            totalWon: won ? payout : 0,
            totalWagered: betAmount,
            wins: won ? 1 : 0,
            losses: won ? 0 : 1,
            biggestWin: won ? payout : 0,
            winRate: won ? 100 : 0,
            lastPlayed: Date.now(),
          };

      const updated = existing
        ? prev.map((e) => (e.address === address ? newEntry : e))
        : [...prev, newEntry];

      // Sort by total won and limit entries
      const sorted = updated
        .sort((a, b) => b.totalWon - a.totalWon)
        .slice(0, MAX_ENTRIES);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
      } catch (error) {
        console.error('Failed to save leaderboard:', error);
      }

      return sorted;
    });
  };

  const getTopPlayers = (limit: number = 10): LeaderboardEntry[] => {
    return leaderboard.slice(0, limit);
  };

  const getBiggestWins = (limit: number = 10): LeaderboardEntry[] => {
    return [...leaderboard]
      .sort((a, b) => b.biggestWin - a.biggestWin)
      .slice(0, limit);
  };

  const getPlayerRank = (address: string): number => {
    const index = leaderboard.findIndex((e) => e.address === address);
    return index === -1 ? -1 : index + 1;
  };

  const clearLeaderboard = () => {
    setLeaderboard([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear leaderboard:', error);
    }
  };

  return {
    leaderboard,
    updateEntry,
    getTopPlayers,
    getBiggestWins,
    getPlayerRank,
    clearLeaderboard,
  };
};
