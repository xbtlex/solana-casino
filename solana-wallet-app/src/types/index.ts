import { PublicKey } from '@solana/web3.js';

export interface WalletInfo {
  publicKey: PublicKey;
  balance: number;
  connected: boolean;
}

export interface TransactionResult {
  signature: string;
  confirmed: boolean;
  error?: string;
}

export interface SendTransactionParams {
  to: PublicKey;
  amount: number; // in SOL
}

export interface TransactionState {
  loading: boolean;
  signature: string | null;
  error: string | null;
}
