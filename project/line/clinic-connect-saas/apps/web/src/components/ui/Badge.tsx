import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?:
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'gray'
    | 'outline';
  size?: 'sm' | 'md';
  className?: string;
  icon?: ReactNode;
}

export function Badge({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
}: BadgeProps) {
  const baseClasses = 'inline-flex items-center font-medium rounded-full';

  const variantClasses = {
    primary: 'bg-blue-100 text-blue-800',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-800',
    info: 'bg-cyan-100 text-cyan-800',
    gray: 'bg-slate-100 text-slate-800',
    outline: 'bg-transparent border border-slate-300 text-slate-700',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status:
    | 'pending'
    | 'confirmed'
    | 'checked_in'
    | 'in_consultation'
    | 'completed'
    | 'cancelled'
    | 'no_show';
  className?: string;
}

const statusConfig = {
  pending: { label: 'รอยืนยัน', variant: 'gray' as const, icon: null },
  confirmed: { label: 'ยืนยันแล้ว', variant: 'primary' as const, icon: null },
  checked_in: { label: 'เช็คอินแล้ว', variant: 'info' as const, icon: null },
  in_consultation: { label: 'กำลังตรวจ', variant: 'warning' as const, icon: null },
  completed: { label: 'เสร็จสิ้น', variant: 'success' as const, icon: null },
  cancelled: { label: 'ยกเลิก', variant: 'danger' as const, icon: null },
  no_show: { label: 'ไม่มา', variant: 'gray' as const, icon: null },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];
  return <Badge variant={config.variant} className={className}>{config.label}</Badge>;
}

interface QueueStatusBadgeProps {
  status: 'waiting' | 'in_queue' | 'in_room' | 'completed' | 'skipped';
  className?: string;
}

const queueStatusConfig = {
  waiting: { label: 'รอคิว', variant: 'gray' as const },
  in_queue: { label: 'ในคิว', variant: 'primary' as const },
  in_room: { label: 'ในห้องตรวจ', variant: 'warning' as const },
  completed: { label: 'เสร็จสิ้น', variant: 'success' as const },
  skipped: { label: 'ข้าม', variant: 'danger' as const },
};

export function QueueStatusBadge({ status, className = '' }: QueueStatusBadgeProps) {
  const config = queueStatusConfig[status];
  return <Badge variant={config.variant} className={className}>{config.label}</Badge>;
}
