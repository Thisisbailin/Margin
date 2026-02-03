import React from 'react';
import AccountTraffic from './account/AccountTraffic';

interface TrafficDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  projectId?: string;
}

const TrafficDashboardModal: React.FC<TrafficDashboardModalProps> = ({ isOpen, onClose, userId, projectId }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-ink/30 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-paper w-full max-w-6xl p-6 md:p-10 rounded-[2.5rem] shadow-float border border-black/5 max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-3xl text-ink italic">AI Traffic Hub</h2>
            <p className="text-[11px] text-gray-400 mt-1">Token 明细与聚合统计</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto no-scrollbar max-h-[75vh] pr-1">
          <AccountTraffic userId={userId} projectId={projectId} isActive={isOpen} />
        </div>
      </div>
    </div>
  );
};

export default TrafficDashboardModal;
