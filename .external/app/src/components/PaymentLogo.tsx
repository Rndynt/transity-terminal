import { cn } from '@/lib/utils';

// QR icon untuk QRIS
const QrisIcon = () => (
  <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
    <rect x="4" y="4" width="14" height="14" rx="2" fill="white"/>
    <rect x="7" y="7" width="8" height="8" rx="1" fill="#00529B"/>
    <rect x="22" y="4" width="14" height="14" rx="2" fill="white"/>
    <rect x="25" y="7" width="8" height="8" rx="1" fill="#00529B"/>
    <rect x="4" y="22" width="14" height="14" rx="2" fill="white"/>
    <rect x="7" y="25" width="8" height="8" rx="1" fill="#00529B"/>
    <rect x="22" y="22" width="6" height="6" rx="1" fill="#00529B"/>
    <rect x="30" y="22" width="6" height="6" rx="1" fill="#00529B"/>
    <rect x="22" y="30" width="6" height="6" rx="1" fill="#00529B"/>
    <rect x="30" y="30" width="6" height="6" rx="1" fill="#00529B"/>
  </svg>
);

// GoPay icon
const GopayIcon = () => (
  <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
    <circle cx="20" cy="20" r="12" fill="white" opacity="0.9"/>
    <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="900" fill="#00AED6" fontFamily="Arial">Go</text>
  </svg>
);

// OVO icon
const OvoIcon = () => (
  <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
    <text x="20" y="25" textAnchor="middle" fontSize="12" fontWeight="900" fill="white" fontFamily="Arial" letterSpacing="1">OVO</text>
  </svg>
);

// DANA icon
const DanaIcon = () => (
  <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
    <text x="20" y="25" textAnchor="middle" fontSize="11" fontWeight="900" fill="white" fontFamily="Arial">DANA</text>
  </svg>
);

// ShopeePay icon
const ShopeePayIcon = () => (
  <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
    <path d="M20 8C15 8 11 12 11 17c0 3 1.5 5.5 3.8 7L13 26l6.5 4 6.5-4-1.8-2c2.3-1.5 3.8-4 3.8-7 0-5-4-9-8-9z" fill="white" opacity="0.9"/>
    <circle cx="20" cy="18" r="3" fill="#EE4D2D"/>
  </svg>
);

// Bank icon
const BankIcon = () => (
  <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <rect x="8" y="16" width="24" height="14" rx="2"/>
    <path d="M8 16L20 8l12 8"/>
    <line x1="13" y1="16" x2="13" y2="30"/>
    <line x1="20" y1="16" x2="20" y2="30"/>
    <line x1="27" y1="16" x2="27" y2="30"/>
  </svg>
);

const LOGOS: Record<string, { bg: string; render: () => JSX.Element }> = {
  // QRIS
  'qris': {
    bg: 'bg-gradient-to-br from-[#00529B] to-[#003d73]',
    render: () => <QrisIcon />,
  },
  // E-Wallets
  'ewallet_gopay': {
    bg: 'bg-[#00AED6]',
    render: () => <GopayIcon />,
  },
  'ewallet_ovo': {
    bg: 'bg-[#4C2A86]',
    render: () => <OvoIcon />,
  },
  'ewallet_dana': {
    bg: 'bg-[#108EE9]',
    render: () => <DanaIcon />,
  },
  'ewallet_shopeepay': {
    bg: 'bg-[#EE4D2D]',
    render: () => <ShopeePayIcon />,
  },
  // Virtual Accounts
  'va_bca': {
    bg: 'bg-gradient-to-br from-[#005BAA] to-[#003d79]',
    render: () => (
      <svg viewBox="0 0 40 20" className="w-8 h-5" fill="none">
        <text x="20" y="15" textAnchor="middle" fontSize="11" fontWeight="900" fill="white" fontFamily="Arial">BCA</text>
      </svg>
    ),
  },
  'va_mandiri': {
    bg: 'bg-gradient-to-br from-[#003876] to-[#001f45]',
    render: () => (
      <svg viewBox="0 0 50 20" className="w-10 h-5" fill="none">
        <text x="3" y="15" fontSize="9" fontWeight="900" fill="#FFCF00" fontFamily="Arial">mandiri</text>
      </svg>
    ),
  },
  'va_bni': {
    bg: 'bg-gradient-to-br from-[#EC6726] to-[#c44d15]',
    render: () => (
      <svg viewBox="0 0 40 20" className="w-8 h-5" fill="none">
        <text x="20" y="15" textAnchor="middle" fontSize="11" fontWeight="900" fill="white" fontFamily="Arial">BNI</text>
      </svg>
    ),
  },
  // Bank Transfer
  'bank_transfer': {
    bg: 'bg-gradient-to-br from-slate-500 to-slate-700',
    render: () => <BankIcon />,
  },
};

interface Props {
  methodId: string;
  size?: 'sm' | 'md';
  selected?: boolean;
}

export default function PaymentLogo({ methodId, size = 'md', selected }: Props) {
  const key = methodId.toLowerCase();
  const logo = LOGOS[key];
  const dim = size === 'sm' ? 'w-9 h-9 rounded-xl' : 'w-11 h-11 rounded-2xl';

  if (logo) {
    return (
      <div className={cn(dim, 'flex items-center justify-center shrink-0 shadow-sm', logo.bg)}>
        {logo.render()}
      </div>
    );
  }

  // Fallback
  return (
    <div className={cn(dim, 'flex items-center justify-center shrink-0', selected ? 'bg-teal-100' : 'bg-slate-100')}>
      <svg viewBox="0 0 24 24" className={cn('w-5 h-5', selected ? 'text-teal-600' : 'text-slate-400')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    </div>
  );
}
