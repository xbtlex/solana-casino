import { useState, useEffect } from 'react';

export interface GameHistoryEntry {
  id: string;
  timestamp: number;
  betAmount: number;
  userChoice: 'heads' | 'tails';
  result: 'heads' | 'tails';
  won: boolean;
  payout: number;
  blockhash?: string;
  slot?: number;
}

const STORAGE_KEY = 'coinflip_game_history';
const MAX_HISTORY = 50;

export const useGameHistory = () => {
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load game history:', error);
    }
  }, []);

  const addEntry = (entry: Omit<GameHistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: GameHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      const updated = [newEntry, ...prev].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save game history:', error);
      }
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear game history:', error);
    }
  };

  return {
    history,
    addEntry,
    clearHistory,
  };
};
