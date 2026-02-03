import React from 'react';
import { UserProficiency } from '../types';
import HomeSettings from './home/HomeSettings';

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
      <HomeSettings
        proficiency={proficiency}
        onProficiencyChange={onProficiencyChange}
        isActive={isOpen}
        showClose={true}
        onClose={onClose}
        className="h-full max-w-5xl w-full"
        panelClassName="h-full"
      />
    </div>
  );
};

export default SettingsModal;
