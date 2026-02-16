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
  toast.className = `${TOAST_COLORS[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-right-full pointer-events-auto transition-all duration-300 max-w-md`;
  toast.innerHTML = `
    <span class="text-xl">${TOAST_ICONS[type]}</span>
    <span class="font-medium">${message}</span>
  `;

  container.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.add('animate-out', 'slide-out-to-right-full');
    setTimeout(() => {
      container?.removeChild(toast);
      // Clean up container if empty
      if (container?.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, duration);
}
