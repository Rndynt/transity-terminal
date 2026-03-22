import { ShieldOff } from 'lucide-react';
import { Link } from 'wouter';

export default function ForbiddenPage() {
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
      <Link href="/cso">
        <span className="text-sm text-blue-600 hover:underline cursor-pointer">
          Kembali ke halaman utama
        </span>
      </Link>
    </div>
  );
}
