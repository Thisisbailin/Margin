import React from 'react';
import { UserProficiency } from '../types';
import AccountSettings from './account/AccountSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  proficiency: UserProficiency;
  onProficiencyChange: (p: UserProficiency) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, proficiency, onProficiencyChange }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-ink/30 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-fade-in">
      <div className="bg-paper w-full max-w-6xl p-6 md:p-10 rounded-[2.5rem] shadow-float border border-black/5 max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl text-ink italic">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto no-scrollbar max-h-[75vh] pr-1">
          <AccountSettings proficiency={proficiency} onProficiencyChange={onProficiencyChange} isActive={isOpen} />
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
