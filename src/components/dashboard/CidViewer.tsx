import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, AlertCircle, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { useHashdUrl } from '../../hooks/useHashdUrl';
import { CryptoUtils } from '../../utils/crypto';

export const CidViewer: React.FC = () => {
  const [cidInput, setCidInput] = useState('');
  const [hashdUrl, setHashdUrl] = useState<string | null>(null);
  const { blobUrl, loading, error } = useHashdUrl(hashdUrl);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  const handleLoadContent = () => {
    let cid = cidInput.trim();
    setDecryptedText(null); // Reset decrypted text
    if (cid.startsWith('hashd://')) {
      setHashdUrl(cid);
    } else if (cid) {
      setHashdUrl(`hashd://${cid}`);
    }
  };

  // Decrypt the blob when it's loaded
  useEffect(() => {
    if (!blobUrl || loading || error) {
      setDecryptedText(null);
      return;
    }

    const decryptBlob = async () => {
      setDecrypting(true);
      try {
        // Fetch the blob data
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();
        const encryptedHex = '0x' + Array.from(new Uint8Array(arrayBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        // Decrypt with test key
        const decrypted = await CryptoUtils.decryptText(encryptedHex);
        setDecryptedText(decrypted);
      } catch (err: any) {
        console.error('Decryption failed:', err);
        setDecryptedText(`[Decryption failed: ${err.message}]`);
      } finally {
        setDecrypting(false);
      }
    };

    decryptBlob();
  }, [blobUrl, loading, error]);

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <ImageIcon className="text-cyan-400" size={20} />
        Content Viewer
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        Load and view stored content using CID or hashd:// protocol
      </p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Content ID (CID)</label>
          <input
            type="text"
            value={cidInput}
            onChange={(e) => setCidInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLoadContent()}
            placeholder="Enter CID or hashd://{cid}"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Example: 78a3ea5e1562e94e80b782405c47f55c04da6bc2ae37614c45513e9c66f24cf6
          </p>
        </div>
        
        <button
          onClick={handleLoadContent}
          disabled={loading || !cidInput.trim()}
          className="w-full px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Database size={16} />
          {loading ? 'Loading via hashd://' : 'Load Content'}
        </button>
      </div>
      
      {loading && (
        <div className="mt-6 flex items-center justify-center py-8">
          <RefreshCw className="animate-spin text-cyan-400" size={32} />
        </div>
      )}
      
      {error && (
        <div className="mt-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm text-red-400 font-medium">Error</p>
              <p className="text-sm text-gray-400 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {blobUrl && !loading && !error && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-400" size={20} />
            <p className="text-sm text-green-400 font-medium">Content loaded via hashd:// protocol</p>
          </div>
          
          {decrypting ? (
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900 flex items-center justify-center">
              <RefreshCw className="animate-spin text-cyan-400 mr-2" size={20} />
              <span className="text-gray-400">Decrypting...</span>
            </div>
          ) : decryptedText ? (
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
              <pre className="text-white whitespace-pre-wrap break-words font-mono text-sm">
                {decryptedText}
              </pre>
            </div>
          ) : (
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
              <img 
                src={blobUrl} 
                alt="Stored content"
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}
          
          <div className="text-xs text-gray-400">
            <span className="font-medium">CID:</span>{' '}
            <code className="bg-gray-900 px-2 py-1 rounded font-mono">
              {cidInput.replace('hashd://', '')}
            </code>
          </div>
        </div>
      )}
    </div>
  );
};
