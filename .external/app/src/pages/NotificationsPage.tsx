import { useNav } from '@/App';
import { Bell, Megaphone, Tag, Info, BellOff } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  icon: typeof Bell;
  iconColor: string;
  iconBg: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const notifications: Notification[] = [
  {
    id: '1',
    icon: Megaphone,
    iconColor: 'text-teal-600',
    iconBg: 'bg-teal-50',
    title: 'Selamat Datang di Transity!',
    message: 'Terima kasih sudah bergabung. Nikmati kemudahan pesan tiket shuttle bus antarkota.',
    time: 'Baru saja',
    read: false,
  },
  {
    id: '2',
    icon: Tag,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    title: 'Promo Member Baru',
    message: 'Dapatkan diskon 10% untuk pemesanan pertamamu. Berlaku hingga akhir bulan ini.',
    time: '1 jam lalu',
    read: false,
  },
  {
    id: '3',
    icon: Info,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-50',
    title: 'Rute Baru Tersedia',
    message: 'Kini tersedia rute Jakarta - Semarang dan Bandung - Yogyakarta. Pesan sekarang!',
    time: '2 hari lalu',
    read: true,
  },
];

export default function NotificationsPage() {
  const { goBack } = useNav();

  return (
    <div className="anim-fade min-h-screen bg-[#f8fafa] safe-pb-24">
      <PageHeader title="Notifikasi" onBack={goBack} />

      <div className="px-4 -mt-2">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <BellOff className="w-14 h-14 text-slate-200" />
            <p className="text-[15px] font-medium text-slate-400">Belum ada notifikasi</p>
            <p className="text-[13px] text-slate-300">Notifikasi promo dan info perjalanan akan muncul di sini</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
            {notifications.map((notif, i) => (
              <div
                key={notif.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-4 transition-colors',
                  i > 0 && 'border-t border-slate-50',
                  !notif.read && 'bg-teal-50/30',
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', notif.iconBg)}>
                  <notif.icon className={cn('w-[18px] h-[18px]', notif.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      'text-[14px] text-slate-700',
                      !notif.read ? 'font-bold' : 'font-medium',
                    )}>{notif.title}</p>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-[13px] text-slate-500 leading-relaxed mt-0.5">{notif.message}</p>
                  <p className="text-[11px] text-slate-300 font-medium mt-1.5">{notif.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
