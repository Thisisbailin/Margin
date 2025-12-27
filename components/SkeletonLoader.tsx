import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
  lines?: number;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ className = "", lines = 3 }) => {
  return (
    <div className={`animate-pulse-slow space-y-3 w-full ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className={`bg-gray-200/70 rounded-full h-2 ${
            i === lines - 1 ? 'w-4/6' : 'w-full'
          }`} 
        />
      ))}
    </div>
  );
};

export default SkeletonLoader;