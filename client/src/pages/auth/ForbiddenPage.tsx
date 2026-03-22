import { ShieldOff } from 'lucide-react';
import { Link } from 'wouter';
import { usePermissions } from '@/lib/permissions';

const PAGE_ROUTES: Array<{ flag: string; path: string; label: string }> = [
  { flag: 'page.cso', path: '/cso', label: 'Reservasi' },
  { flag: 'page.cargo', path: '/cargo', label: 'Kargo' },
  { flag: 'page.bookings', path: '/bookings', label: 'All Bookings' },
  { flag: 'page.schedule', path: '/schedule', label: 'Jadwal Harian' },
  { flag: 'page.spj', path: '/spj', label: 'SPJ' },
  { flag: 'page.manifest', path: '/manifest', label: 'Manifest' },
  { flag: 'page.masters', path: '/masters', label: 'Master Data' },
  { flag: 'report.revenue', path: '/reports/revenue', label: 'Laporan Pendapatan' },
  { flag: 'report.sales', path: '/reports/sales', label: 'Laporan Penjualan' },
  { flag: 'report.trip_profitability', path: '/reports/trip-profitability', label: 'Laporan Laba Rugi' },
  { flag: 'report.load_factor', path: '/reports/load-factor', label: 'Laporan Load Factor' },
  { flag: 'report.cancellations', path: '/reports/cancellations', label: 'Laporan Pembatalan' },
  { flag: 'report.cargo', path: '/reports/cargo', label: 'Laporan Kargo' },
  { flag: 'report.payments', path: '/reports/payments', label: 'Laporan Pembayaran' },
  { flag: 'admin.staff.manage', path: '/admin/staff', label: 'Kelola Staff' },
  { flag: 'admin.flags.manage', path: '/admin/flags', label: 'Feature Flags' },
];

export default function ForbiddenPage() {
  const { can } = usePermissions();
  const homePage = PAGE_ROUTES.find(r => can(r.flag));

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <ShieldOff className="w-8 h-8 text-red-500" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-800">Akses Ditolak</h2>
        <p className="text-sm text-gray-500 mt-1">
          Anda tidak memiliki izin untuk mengakses halaman ini.
        </p>
      </div>
      {homePage ? (
        <Link href={homePage.path}>
          <span className="text-sm text-blue-600 hover:underline cursor-pointer">
            Kembali ke {homePage.label}
          </span>
        </Link>
      ) : (
        <p className="text-xs text-gray-400">Hubungi administrator untuk mendapatkan akses.</p>
      )}
    </div>
  );
}
