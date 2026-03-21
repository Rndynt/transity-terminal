import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ message = 'Memuat...', className = '', size = 'md' }: LoadingStateProps) {
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs';
  const padding = size === 'sm' ? 'py-4' : size === 'lg' ? 'py-12' : 'py-8';

  return (
    <div className={`text-center ${padding} ${className}`} data-testid="loading-state">
      <Loader2 className={`${iconSize} animate-spin mx-auto text-blue-500`} />
      {message && <p className={`${textSize} text-gray-400 mt-1.5`}>{message}</p>}
    </div>
  );
}
