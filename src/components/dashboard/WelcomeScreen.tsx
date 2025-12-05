import React from 'react';
import { ConnectWallet } from '../ConnectWallet';

interface WelcomeScreenProps {
  onConnect: (address: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onConnect }) => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        <img src="/logo.png" alt="Hashd Logo" className="w-32 h-32 mx-auto mb-6" />
        <h1 className="text-4xl font-bold text-white mb-4">The HASHDash</h1>
        <p className="text-xl text-gray-300 mb-6">Official Management Portal</p>
        
        <div className="card p-8 mb-8 text-left">
          <h2 className="text-lg font-bold text-cyan-400 mb-4">Dashboard Features</h2>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-3">
              <span className="text-cyan-400 mt-1">•</span>
              <span><strong className="text-white">Waitlist Management:</strong> Review, approve, and manage user applications</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-cyan-400 mt-1">•</span>
              <span><strong className="text-white">Analytics:</strong> View registration statistics and trends</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-cyan-400 mt-1">•</span>
              <span><strong className="text-white">Communication:</strong> Resend verification emails and manage user outreach</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-cyan-400 mt-1">•</span>
              <span><strong className="text-white">Data Export:</strong> Download waitlist data for analysis</span>
            </li>
          </ul>
        </div>

        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mb-8">
          <p className="text-sm text-gray-400">
            <strong className="text-cyan-400">Note:</strong> This dashboard manages the official HASHD website and waitlist.
            <br/>It is <strong>not a dependency</strong> of the main protocol.
          </p>
        </div>
        
        <div className="flex justify-center">
          <ConnectWallet onConnect={onConnect} />
        </div>
      </div>
    </div>
  );
};
