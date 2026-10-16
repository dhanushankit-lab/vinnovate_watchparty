import React, { useState } from 'react';
import { AVATAR_COLORS, updateIdentity } from '../services/identity';
import { XIcon } from '../icons';

interface ProfileModalProps {
  currentName: string;
  currentColor: string;
  onSave: (name: string, color: string) => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  currentName,
  currentColor,
  onSave,
  onClose
}) => {
  const [name, setName] = useState(currentName);
  const [color, setColor] = useState(currentColor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateIdentity(name.trim(), color);
    onSave(name.trim(), color);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white transition"
        >
          <XIcon size={18} />
        </button>

        <h2 className="text-base font-bold text-slate-100 mb-4">Edit Profile</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center mb-2">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-white shadow-lg transition-transform"
              style={{ backgroundColor: color }}
            >
              {(name || 'U').charAt(0).toUpperCase()}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-brand-500"
              maxLength={30}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Avatar Color
            </label>
            <div className="flex gap-2 justify-center py-1">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-500/20"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
