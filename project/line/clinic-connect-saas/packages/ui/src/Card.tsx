/**
 * Card Component
 * Container component for content sections
 */

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ children, title, action, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {(title || action) && (
        <div className="px-4 py-3 sm:px-6 flex justify-between items-center border-b border-gray-100">
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {action && <div className="ml-4">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4 sm:p-6'}>
        {children}
      </div>
    </div>
  );
}
