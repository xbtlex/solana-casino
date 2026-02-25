# Automatic Payout Setup Guide

## Overview
For winners to receive automatic SOL payouts, you need to enable automatic transfers from the house wallet.

## ⚠️ Security Warning
**NEVER store private keys in frontend code!** The system below is for demonstration. In production, use a backend service or Solana program.

## Setup Options

### Option 1: Backend Service (Recommended for Production)
Create a backend API that:
1. Monitors winning transactions
2. Holds the house wallet private key securely
3. Automatically sends payouts to winners
4. Logs all transactions

Example backend endpoint:
```typescript
POST /api/payout
Body: { winnerAddress: string, amount: number, gameId: string }
Response: { signature: string, success: boolean }
```

### Option 2: Manual Payouts (Current Setup)
When someone wins:
1. Game shows "Payout Pending"
2. You manually send SOL from house wallet to winner
3. Winner receives notification

**House Wallet:** `2Lohfz4wUTRGmr7cBGU12sd1TNZHBMLL4N9BMvBnoFaC`

### Option 3: Solana Program (Best for Production)
Create a Rust program that:
- Holds funds in a PDA (Program Derived Address)
- Uses Switchboard VRF for on-chain randomness
- Automatically pays winners
- Cannot be manipulated

## Current Implementation
- Losses: Automatic (SOL sent to house wallet)
- Wins: Manual (requires you to send SOL from house wallet)

## Funding the House Wallet
The house wallet needs SOL to pay winners. Send SOL to:
```
2Lohfz4wUTRGmr7cBGU12sd1TNZHBMLL4N9BMvBnoFaC
```

Recommended starting balance: 10+ SOL

## Testing
1. Fund house wallet with SOL
2. Connect with test wallet
3. Play and win
4. Check console for payout instructions
5. Manually send payout from house wallet

## Future Enhancements
- Automated backend payout system
- Webhook notifications for wins
- Admin dashboard for payout management
- Escrow system for fairness
