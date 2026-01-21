import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, AlertCircle, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { useHashdUrl } from '@gethashd/bytecave-browser';
import { CryptoUtils } from '../../utils/crypto';

export const CidViewer: React.FC = () => {
  const [cidInput, setCidInput] = useState('');
  const [hashdUrl, setHashdUrl] = useState<string | null>(null);
  const { blobUrl, loading, error } = useHashdUrl(hashdUrl);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState<boolean | null>(null);
  const [contentType, setContentType] = useState<'text' | 'image' | 'unknown'>('unknown');

  const handleLoadContent = () => {
    let cid = cidInput.trim();
    setDecryptedText(null);
    setIsEncrypted(null);
    setContentType('unknown');
    if (cid.startsWith('hashd://')) {
      setHashdUrl(cid);
    } else if (cid) {
      setHashdUrl(`hashd://${cid}`);
    }
  };

  // Try to decrypt the blob when it's loaded, with fallback for unencrypted content
  useEffect(() => {
    if (!blobUrl || loading || error) {
      setDecryptedText(null);
      setIsEncrypted(null);
      setContentType('unknown');
      return;
    }

    const processBlob = async () => {
      setDecrypting(true);
      try {
        // Fetch the blob data
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // Try to decrypt first (for encrypted content)
        try {
          const encryptedHex = '0x' + Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          
          const decrypted = await CryptoUtils.decryptText(encryptedHex);
          
          // If decryption succeeded, it was encrypted text
          setDecryptedText(decrypted);
          setIsEncrypted(true);
          setContentType('text');
        } catch (decryptErr) {
          // Decryption failed - content is not encrypted
          setIsEncrypted(false);
          
          // Check if it's an image by looking at magic bytes
          const isImage = (
            (bytes[0] === 0xFF && bytes[1] === 0xD8) || // JPEG
            (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) || // PNG
            (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) || // GIF
            (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) // WEBP
          );
          
          if (isImage) {
            setContentType('image');
          } else {
            // Try to decode as UTF-8 text
            try {
              const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
              setDecryptedText(text);
              setContentType('text');
            } catch {
              setContentType('unknown');
            }
          }
        }
      } catch (err: any) {
        console.error('Content processing failed:', err);
        setDecryptedText(`[Error: ${err.message}]`);
        setIsEncrypted(null);
      } finally {
        setDecrypting(false);
      }
    };

    processBlob();
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-green-400" size={20} />
              <p className="text-sm text-green-400 font-medium">Content loaded via hashd:// protocol</p>
            </div>
            
            {/* Encryption Status Badge */}
            {isEncrypted !== null && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                isEncrypted 
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                  : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
              }`}>
                {isEncrypted ? '🔒 Encrypted' : '🔓 Unencrypted'}
              </div>
            )}
          </div>
          
          {decrypting ? (
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900 flex items-center justify-center">
              <RefreshCw className="animate-spin text-cyan-400 mr-2" size={20} />
              <span className="text-gray-400">Processing content...</span>
            </div>
          ) : contentType === 'text' && decryptedText ? (
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                <span>📄 Text Content</span>
                {isEncrypted && <span className="text-purple-400">(Decrypted)</span>}
              </div>
              <pre className="text-white whitespace-pre-wrap break-words font-mono text-sm">
                {decryptedText}
              </pre>
            </div>
          ) : contentType === 'image' ? (
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
              <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                <span>🖼️ Image Content</span>
              </div>
              <img 
                src={blobUrl} 
                alt="Stored content"
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          ) : contentType === 'unknown' ? (
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">⚠️ Unknown content type</p>
                <p className="text-gray-500 text-xs mt-2">Cannot display this content</p>
                <a 
                  href={blobUrl}
                  download
                  className="inline-block mt-3 px-4 py-2 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  Download Raw Data
                </a>
              </div>
            </div>
          ) : null}
          
          <div className="text-xs text-gray-400 space-y-1">
            <div>
              <span className="font-medium">CID:</span>{' '}
              <code className="bg-gray-900 px-2 py-1 rounded font-mono">
                {cidInput.replace('hashd://', '')}
              </code>
            </div>
            {contentType !== 'unknown' && (
              <div>
                <span className="font-medium">Type:</span>{' '}
                <span className="text-gray-500">
                  {contentType === 'text' ? 'Text' : contentType === 'image' ? 'Image' : 'Unknown'}
                  {isEncrypted && ' (Encrypted)'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
