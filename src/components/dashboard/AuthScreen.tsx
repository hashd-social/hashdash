import React from 'react';

interface AuthScreenProps {
  isAuthenticating: boolean;
  onAuthenticate: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ isAuthenticating, onAuthenticate }) => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <img src="/logo.png" alt="Hashd Logo" className="w-24 h-24 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">Admin Authentication</h1>
        <p className="text-gray-400 mb-6">Sign a message to verify your admin access</p>
        <button onClick={onAuthenticate} disabled={isAuthenticating} className="btn-primary w-full">
          {isAuthenticating ? 'Authenticating...' : 'Sign Message to Continue'}
        </button>
      </div>
    </div>
  );
};
