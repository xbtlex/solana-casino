import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export const WalletConnectButton = () => {
  return (
    <WalletMultiButton
      style={{
        background: 'linear-gradient(to right, #7fffd4, #5cccaa)',
        color: '#0a1f1c',
        borderRadius: '9999px',
        fontWeight: 600,
        padding: '12px 24px',
        fontSize: '14px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
    />
  );
};
