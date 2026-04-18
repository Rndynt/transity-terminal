import { useNav } from '@/App';
import { Shield, FileText, Mail, Globe, Heart, ExternalLink } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';

const APP_VERSION = '1.0.0';

export default function AboutPage() {
  const { goBack } = useNav();

  const links = [
    { icon: Shield, label: 'Kebijakan Privasi', href: '#privacy', color: 'text-teal-600', bg: 'bg-teal-50' },
    { icon: FileText, label: 'Syarat & Ketentuan', href: '#terms', color: 'text-blue-500', bg: 'bg-blue-50' },
    { icon: Mail, label: 'Hubungi Kami', href: 'mailto:support@transity.web.id', color: 'text-amber-600', bg: 'bg-amber-50' },
    { icon: Globe, label: 'Website', href: 'https://transity.web.id', color: 'text-indigo-500', bg: 'bg-indigo-50' },
  ];

  return (
    <div className="anim-fade min-h-screen bg-[#f8fafa] safe-pb-24">
      <PageHeader title="Tentang Aplikasi" onBack={goBack} />

      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden mb-4">
          <div className="flex flex-col items-center py-8 px-6">
            <div className="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-teal-700 to-emerald-600 flex items-center justify-center shadow-glow mb-4">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/>
                <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
                <circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>
              </svg>
            </div>
            <h2 className="font-display font-extrabold text-[24px] text-slate-800">Transity</h2>
            <p className="text-[13px] text-slate-400 mt-1">Versi {APP_VERSION}</p>
            <p className="text-[13px] text-slate-500 text-center mt-3 leading-relaxed max-w-[260px]">
              Aplikasi pemesanan tiket shuttle bus antarkota. Satu aplikasi untuk semua operator.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft overflow-hidden mb-4">
          {links.map((item, i) => (
            <a
              key={item.label}
              href={item.href}
              target={item.href.startsWith('http') ? '_blank' : undefined}
              rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors',
                i > 0 && 'border-t border-slate-50',
              )}
            >
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', item.bg)}>
                <item.icon className={cn('w-[18px] h-[18px]', item.color)} />
              </div>
              <span className="flex-1 text-[14px] font-medium text-slate-700">{item.label}</span>
              <ExternalLink className="w-4 h-4 text-slate-300" />
            </a>
          ))}
        </div>

        <div className="flex flex-col items-center py-6 gap-1">
          <div className="flex items-center gap-1 text-[12px] text-slate-300">
            <span>Dibuat dengan</span>
            <Heart className="w-3 h-3 text-red-400 fill-red-400" />
            <span>di Indonesia</span>
          </div>
          <p className="text-[11px] text-slate-300">&copy; 2026 Transity. Hak cipta dilindungi.</p>
        </div>
      </div>
    </div>
  );
}
