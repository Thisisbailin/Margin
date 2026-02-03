import React from 'react';
import HomeTraffic from './home/HomeTraffic';

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
      <HomeTraffic
        userId={userId}
        projectId={projectId}
        isActive={isOpen}
        showClose={true}
        onClose={onClose}
        className="h-full max-w-6xl w-full"
        panelClassName="h-full"
      />
    </div>
  );
};

export default TrafficDashboardModal;
