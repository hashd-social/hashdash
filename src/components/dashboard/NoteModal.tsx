import React from 'react';
import { X } from 'lucide-react';

interface NoteModalProps {
  note: string;
  onClose: () => void;
}

export const NoteModal: React.FC<NoteModalProps> = ({ note, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="card max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-white">User Note</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-300 whitespace-pre-wrap">{note}</p>
          </div>
        </div>
        <div className="flex justify-end p-6 border-t border-gray-700">
          <button onClick={onClose} className="btn-primary">Close</button>
        </div>
      </div>
    </div>
  );
};
