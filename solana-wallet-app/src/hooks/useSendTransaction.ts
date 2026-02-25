import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import { COMMITMENT } from '../config/solana-config';

interface UseSendTransactionReturn {
  sendTransaction: (to: PublicKey, lamports: number) => Promise<string>;
  loading: boolean;
  txSignature: string | null;
  txError: string | null;
  reset: () => void;
}

/**
 * Custom hook for sending SOL transactions
 */
export const useSendTransaction = (): UseSendTransactionReturn => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction: walletSendTransaction } = useWallet();

  const [loading, setLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTxSignature(null);
    setTxError(null);
  }, []);

  const sendTransaction = useCallback(
    async (to: PublicKey, lamports: number): Promise<string> => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setTxSignature(null);
      setTxError(null);

      try {
        // Create transfer instruction
        const transferInstruction = SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: to,
          lamports,
        });

        // Create transaction
        const transaction = new Transaction().add(transferInstruction);

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash(COMMITMENT);

        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        console.log('Sending transaction...');

        // Send transaction (wallet will prompt for signature)
        const signature = await walletSendTransaction(transaction, connection);

        console.log('Transaction sent:', signature);
        console.log('Confirming transaction...');

        // Confirm transaction
        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          COMMITMENT
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        console.log('Transaction confirmed:', signature);
        setTxSignature(signature);
        return signature;
      } catch (error) {
        console.error('Transaction error:', error);

        let errorMessage = 'Transaction failed';

        if (error instanceof Error) {
          errorMessage = error.message;

          // Parse common error messages
          if (errorMessage.includes('User rejected')) {
            errorMessage = 'Transaction rejected by user';
          } else if (errorMessage.includes('insufficient funds')) {
            errorMessage = 'Insufficient balance for transaction';
          } else if (errorMessage.includes('blockhash not found')) {
            errorMessage = 'Transaction expired, please try again';
          }
        }

        setTxError(errorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, walletSendTransaction]
  );

  return {
    sendTransaction,
    loading,
    txSignature,
    txError,
    reset,
  };
};
