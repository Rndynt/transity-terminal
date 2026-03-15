import { useState, useEffect } from 'react';

export interface ToastData {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  open: boolean;
  dismissing?: boolean;
}

type ToastInput = Omit<ToastData, 'id' | 'open' | 'dismissing'>;

let count = 0;
const genId = () => String(++count % Number.MAX_SAFE_INTEGER);

let memoryToasts: ToastData[] = [];
const listeners: Array<(toasts: ToastData[]) => void> = [];

function notify() {
  listeners.forEach(fn => fn([...memoryToasts]));
}

function dismissToast(id: string) {
  memoryToasts = memoryToasts.map(t => t.id === id ? { ...t, dismissing: true } : t);
  notify();
  setTimeout(() => {
    memoryToasts = memoryToasts.filter(t => t.id !== id);
    notify();
  }, 300);
}

function toast(props: ToastInput) {
  const id = genId();
  const entry: ToastData = { ...props, id, open: true };
  memoryToasts = [entry, ...memoryToasts].slice(0, 5);
  notify();

  setTimeout(() => dismissToast(id), 4000);

  return { id, dismiss: () => dismissToast(id) };
}

function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>(memoryToasts);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      const i = listeners.indexOf(setToasts);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);

  return { toasts, toast, dismiss: dismissToast };
}

export { useToast, toast };
