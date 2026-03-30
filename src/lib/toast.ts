// Simple toast notification system
export type ToastType = 'success' | 'info' | 'warning' | 'error';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

const TOAST_ICONS = {
  success: '✅',
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
};

const TOAST_COLORS = {
  success: 'bg-green-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

export function showToast({ message, type = 'success', duration = 3000 }: ToastOptions) {
  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `${TOAST_COLORS[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-right-full pointer-events-auto transition-all duration-300 max-w-md relative overflow-hidden`;
  const iconSpan = document.createElement('span');
  iconSpan.className = 'text-xl';
  iconSpan.textContent = TOAST_ICONS[type];
  const msgSpan = document.createElement('span');
  msgSpan.className = 'font-medium';
  msgSpan.textContent = message;
  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);

  // Progress bar — thin countdown at the bottom
  const bar = document.createElement('div');
  bar.style.cssText = `position:absolute;bottom:0;left:0;height:3px;width:100%;background:rgba(255,255,255,0.35);transform-origin:left;animation:toast-progress ${duration}ms linear forwards;`;
  toast.appendChild(bar);

  // Inject keyframe on first use
  if (!document.getElementById('toast-progress-style')) {
    const style = document.createElement('style');
    style.id = 'toast-progress-style';
    style.textContent = '@keyframes toast-progress{from{transform:scaleX(1)}to{transform:scaleX(0)}}';
    document.head.appendChild(style);
  }

  container.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.add('animate-out', 'slide-out-to-right-full');
    setTimeout(() => {
      if (container?.contains(toast)) container.removeChild(toast);
      // Clean up container if empty
      if (container?.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, duration);
}
