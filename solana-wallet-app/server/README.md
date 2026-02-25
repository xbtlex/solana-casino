# Coin Flip Payout Server

This server handles payouts from the house wallet to winning players.

## Setup

### 1. Generate a House Wallet

For **devnet testing**, you can generate a new wallet:

```bash
# Install Solana CLI if you haven't
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate a new keypair
solana-keygen new --outfile house-wallet.json

# Get the public key
solana address -k house-wallet.json

# Fund it with devnet SOL
solana airdrop 5 <your-address> --url devnet
```

### 2. Configure Environment

Copy the `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your house wallet's private key:

**Option A: JSON array format** (from Phantom export or solana-keygen):

```
HOUSE_WALLET_PRIVATE_KEY=[1,2,3,4,...64 numbers]
```

**Option B: Base58 format**:

```
HOUSE_WALLET_PRIVATE_KEY=your_base58_private_key
```

To get the JSON format from a Solana keypair file:

```bash
cat house-wallet.json
# This outputs the JSON array, copy it to .env
```

### 3. Start the Server

```bash
npm start
```

The server will start on http://localhost:3001

### 4. Verify Setup

Check the health endpoint:

```bash
curl http://localhost:3001/api/health
```

You should see:

```json
{
    "status": "ok",
    "houseWalletConfigured": true,
    "houseWalletAddress": "YOUR_ADDRESS",
    "network": "devnet"
}
```

## API Endpoints

| Endpoint             | Method | Description                         |
| -------------------- | ------ | ----------------------------------- |
| `/api/health`        | GET    | Server status and house wallet info |
| `/api/house/balance` | GET    | House wallet SOL balance            |
| `/api/payout`        | POST   | Process a payout to a winner        |
| `/api/payouts`       | GET    | List recent payouts                 |

## Running Frontend + Backend

In one terminal:

```bash
cd server
npm start
```

In another terminal:

```bash
cd ..
npm run dev
```

## Security Notes

⚠️ **NEVER commit the `.env` file!**

⚠️ **NEVER expose the private key in frontend code!**

⚠️ **For production, use proper secret management (AWS Secrets Manager, Vault, etc.)**
