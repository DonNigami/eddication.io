/**
 * StatusBadge Component
 * Displays status with color coding
 */

export interface StatusProps {
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig = {
  pending: { label: 'รอยืนยัน', color: 'bg-gray-100 text-gray-700' },
  confirmed: { label: 'ยืนยัน', color: 'bg-green-100 text-green-700' },
  checked_in: { label: 'เช็คอิน', color: 'bg-blue-100 text-blue-700' },
  in_consultation: { label: 'กำลังตรวจ', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'เสร็จสิ้น', color: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-700' },
  no_show: { label: 'ไม่มา', color: 'red-100 text-red-700' },
};

export function StatusBadge({ status, size = 'md', className = '' }: StatusProps) {
  const config = statusConfig[status];
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.color} ${sizeClasses[size]} ${className}`}>
      {config.label}
    </span>
  );
}
