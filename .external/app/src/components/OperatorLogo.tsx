import { Bus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  name: string;
  logo: string | null | undefined;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { box: 'w-8 h-8 rounded-lg', icon: 'w-3.5 h-3.5', text: 'text-[11px]', img: 'w-4 h-4' },
  md: { box: 'w-10 h-10 rounded-xl', icon: 'w-4.5 h-4.5', text: 'text-[13px]', img: 'w-5 h-5' },
  lg: { box: 'w-12 h-12 rounded-xl', icon: 'w-5 h-5', text: 'text-[15px]', img: 'w-6 h-6' },
};

export default function OperatorLogo({ name, logo, color, size = 'md', className }: Props) {
  const s = sizes[size];
  const initial = name.charAt(0).toUpperCase();

  if (logo) {
    return (
      <div
        className={cn(s.box, 'flex items-center justify-center shrink-0 overflow-hidden border border-slate-100', className)}
        style={{ backgroundColor: `${color}08` }}
      >
        <img src={logo} alt={name} className={cn(s.img, 'object-contain')} />
      </div>
    );
  }

  return (
    <div
      className={cn(s.box, 'flex items-center justify-center shrink-0 relative overflow-hidden', className)}
      style={{ backgroundColor: `${color}15` }}
    >
      <span className={cn(s.text, 'font-extrabold font-display')} style={{ color }}>{initial}</span>
      <Bus
        className="absolute bottom-0 right-0 opacity-[0.08]"
        style={{ color, width: '70%', height: '70%', transform: 'translate(15%, 15%)' }}
      />
    </div>
  );
}
