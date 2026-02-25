import { PublicKey } from '@solana/web3.js';

/**
 * Validate if a string is a valid Solana address
 */
export const validateSolanaAddress = (address: string): boolean => {
  if (!address || address.trim() === '') {
    return false;
  }

  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate if an amount string is valid
 */
export const validateAmount = (amount: string): boolean => {
  if (!amount || amount.trim() === '') {
    return false;
  }

  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && isFinite(num);
};

/**
 * Validate if user has sufficient balance
 */
export const validateBalance = (
  amount: number,
  balance: number,
  fee: number = 0.000005 // Approximate transaction fee
): { valid: boolean; error?: string } => {
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' };
  }

  if (amount + fee > balance) {
    return {
      valid: false,
      error: `Insufficient balance. Need ${amount + fee} SOL (includes fee)`,
    };
  }

  return { valid: true };
};
