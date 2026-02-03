import React from 'react';
import HomeMeditation from './home/HomeMeditation';

interface MeditationRoomProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  projectId?: string;
  bookId?: string;
}

const MeditationRoom: React.FC<MeditationRoomProps> = ({ isOpen, onClose, userId, projectId, bookId }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-paper animate-fade-in-up p-6 md:p-12 overflow-hidden">
      <HomeMeditation
        userId={userId}
        projectId={projectId}
        bookId={bookId}
        isActive={isOpen}
        showClose={true}
        onClose={onClose}
        className="h-full"
        panelClassName="h-full"
      />
    </div>
  );
};

export default MeditationRoom;
