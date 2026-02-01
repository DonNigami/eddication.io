/**
 * Toast Component
 * Notification toast messages
 */

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
}

const toastConfig = {
  success: { icon: '✅', bgColor: 'bg-green-500' },
  error: { icon: '❌', bgColor: 'bg-red-500' },
  warning: { icon: '⚠️', bgColor: 'bg-yellow-500' },
  info: { icon: 'ℹ️', bgColor: 'bg-blue-500' },
};

export function Toast({ message, type = 'info', onClose }: ToastProps) {
  const config = toastConfig[type];

  return (
    <div className={`${config.bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2`}>
      <span>{config.icon}</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="hover:opacity-80">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
