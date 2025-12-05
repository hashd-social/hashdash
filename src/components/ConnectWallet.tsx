import React, { useState } from 'react';
import { Wallet } from 'lucide-react';

interface ConnectWalletProps {
  onConnect: (address: string) => void;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const ConnectWallet: React.FC<ConnectWalletProps> = ({ onConnect }) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask to connect your wallet');
      return;
    }

    setIsConnecting(true);
    
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[];
      
      if (accounts.length > 0) {
        onConnect(accounts[0]);
      }
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 4001) {
        alert('Connection rejected by user');
      } else {
        alert('Failed to connect wallet');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="btn-primary flex items-center gap-2"
    >
      <Wallet className="w-5 h-5" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
};
