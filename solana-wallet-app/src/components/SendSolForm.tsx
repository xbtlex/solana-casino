import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useSendTransaction } from '../hooks/useSendTransaction';
import { validateSolanaAddress, validateAmount, validateBalance } from '../utils/validation';
import { solToLamports, getBalance, getExplorerUrl } from '../utils/solana';
import { SOLANA_NETWORK } from '../config/solana-config';
import { Send, ExternalLink, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export const SendSolForm = () => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { sendTransaction, loading, txSignature, txError, reset } = useSendTransaction();

  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<number>(0);
  const [errors, setErrors] = useState<{ address?: string; amount?: string }>({});

  // Fetch balance
  useEffect(() => {
    if (!publicKey || !connected) {
      setBalance(0);
      return;
    }

    const fetchBalance = async () => {
      try {
        const bal = await getBalance(connection, publicKey);
        setBalance(bal);
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    };

    fetchBalance();
  }, [publicKey, connected, connection, txSignature]);

  const validate = (): boolean => {
    const newErrors: { address?: string; amount?: string } = {};

    // Validate address
    if (!recipientAddress.trim()) {
      newErrors.address = 'Recipient address is required';
    } else if (!validateSolanaAddress(recipientAddress)) {
      newErrors.address = 'Invalid Solana address';
    } else if (publicKey && recipientAddress === publicKey.toBase58()) {
      newErrors.address = 'Cannot send to your own address';
    }

    // Validate amount
    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (!validateAmount(amount)) {
      newErrors.amount = 'Invalid amount';
    } else {
      const amountNum = parseFloat(amount);
      const balanceCheck = validateBalance(amountNum, balance);
      if (!balanceCheck.valid) {
        newErrors.amount = balanceCheck.error;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !connected || !publicKey) {
      return;
    }

    try {
      const recipientPubkey = new PublicKey(recipientAddress);
      const lamports = solToLamports(parseFloat(amount));

      await sendTransaction(recipientPubkey, lamports);

      // Clear form on success
      setRecipientAddress('');
      setAmount('');
      setErrors({});
    } catch (error) {
      // Error is handled by the hook
      console.error('Transaction failed:', error);
    }
  };

  const handleDismissSuccess = () => {
    reset();
  };

  if (!connected) {
    return (
      <div className="glass-card p-8 text-center">
        <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          Connect your wallet to send SOL
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-6">
      <h3 className="text-2xl font-bold text-white flex items-center gap-3">
        <Send className="w-6 h-6 text-primary" />
        Send SOL
      </h3>

      {/* Success Message */}
      {txSignature && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-green-400 font-semibold">Transaction Successful!</p>
              <p className="text-sm text-green-300/80 font-mono break-all">
                {txSignature}
              </p>
              <a
                href={getExplorerUrl(txSignature, SOLANA_NETWORK)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition-colors"
              >
                View on Solana Explorer
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <button
              onClick={handleDismissSuccess}
              className="text-green-400/60 hover:text-green-400 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {txError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 font-semibold">Transaction Failed</p>
              <p className="text-sm text-red-300/80 mt-1">{txError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Recipient Address */}
        <div className="space-y-2">
          <label htmlFor="recipient" className="block text-sm font-medium text-muted-foreground">
            Recipient Address
          </label>
          <input
            id="recipient"
            type="text"
            value={recipientAddress}
            onChange={(e) => {
              setRecipientAddress(e.target.value);
              setErrors({ ...errors, address: undefined });
            }}
            placeholder="Enter Solana address..."
            className={`w-full bg-white/5 border ${
              errors.address ? 'border-red-500/50' : 'border-white/10'
            } rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all font-mono text-sm`}
            disabled={loading}
          />
          {errors.address && (
            <p className="text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errors.address}
            </p>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <label htmlFor="amount" className="block text-sm font-medium text-muted-foreground">
            Amount (SOL)
          </label>
          <div className="relative">
            <input
              id="amount"
              type="text"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setErrors({ ...errors, amount: undefined });
              }}
              placeholder="0.00"
              className={`w-full bg-white/5 border ${
                errors.amount ? 'border-red-500/50' : 'border-white/10'
              } rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all font-mono text-lg`}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setAmount(Math.max(0, balance - 0.000005).toString())}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-primary hover:text-accent transition-colors font-semibold"
              disabled={loading}
            >
              MAX
            </button>
          </div>
          {errors.amount && (
            <p className="text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errors.amount}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Available: {balance.toFixed(4)} SOL
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#7fffd4] to-[#5cccaa] hover:shadow-[0_0_40px_rgba(127,255,212,0.6)] transition-all duration-300 px-6 py-4 rounded-full font-bold text-[#0a1f1c] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />

          <div className="relative flex items-center gap-3">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending Transaction...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send Transaction
              </>
            )}
          </div>
        </button>
      </form>
    </div>
  );
};

// Fix missing import
import { Wallet } from 'lucide-react';
