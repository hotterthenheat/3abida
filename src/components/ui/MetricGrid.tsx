import React from 'react';

interface MetricGridProps {
  /** Minimum card width before wrapping */
  min?: string;
  className?: string;
  children: React.ReactNode;
}

/** Responsive auto-fit grid for StatCards. */
const MetricGrid = ({ min = '150px', className = '', children }: MetricGridProps) => {
  return (
    <div className={`grid gap-3 ${className}`} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))` }}>
      {children}
    </div>
  );
};

export default MetricGrid;
