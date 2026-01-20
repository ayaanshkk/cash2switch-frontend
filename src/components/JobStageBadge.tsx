import React from 'react';

interface JobStageBadgeProps {
  stage: 'Survey' | 'Delivery' | 'Installation';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const JobStageBadge: React.FC<JobStageBadgeProps> = ({ 
  stage, 
  size = 'md',
  showIcon = true 
}) => {
  const stageConfig = {
    'Survey': {
      color: 'text-purple-700',
      bg: 'bg-purple-100 border-purple-300',
      icon: '📏'
    },
    'Delivery': {
      color: 'text-cyan-700',
      bg: 'bg-cyan-100 border-cyan-300',
      icon: '🚚'
    },
    'Installation': {
      color: 'text-teal-700',
      bg: 'bg-teal-100 border-teal-300',
      icon: '🏗️'
    }
  };

  const config = stageConfig[stage];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 
        rounded-full border font-medium
        ${config.color} ${config.bg} ${sizeClasses[size]}
      `}
      title={`Job Stage: ${stage}`}
    >
      {showIcon && <span>{config.icon}</span>}
      <span>{stage}</span>
    </span>
  );
};

export default JobStageBadge;