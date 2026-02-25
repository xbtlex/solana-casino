import React, { useMemo } from "react"
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets"
import { SOLANA_RPC_ENDPOINT } from "../config/solana-config"

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css"

interface Props {
    children: React.ReactNode
}

export const WalletConnectionProvider = ({ children }: Props) => {
    // Only include Phantom and Solflare - the most common Solana wallets
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter()
        ],
        []
    )

    return (
        <ConnectionProvider endpoint={SOLANA_RPC_ENDPOINT}>
            <WalletProvider
                wallets={wallets}
                autoConnect={false}
                onError={(error) => {
                    console.error("Wallet error:", error)
                }}
            >
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    )
}
