import { useState } from 'react';
import { useNav } from '@/App';
import { ChevronDown, Search, MessageCircle, HelpCircle, CreditCard, Ticket, Ban, Clock, MapPin } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';

interface FaqItem {
  q: string;
  a: string;
  icon: typeof HelpCircle;
  category: string;
}

const faqs: FaqItem[] = [
  {
    icon: Ticket,
    category: 'Pemesanan',
    q: 'Bagaimana cara memesan tiket?',
    a: 'Pilih kota asal dan tujuan, tanggal perjalanan, lalu cari jadwal. Pilih jadwal yang sesuai, tentukan titik naik dan turun, pilih kursi, lalu konfirmasi pemesanan.',
  },
  {
    icon: MapPin,
    category: 'Pemesanan',
    q: 'Apa itu titik naik dan titik turun?',
    a: 'Titik naik adalah halte tempat kamu akan dijemput, dan titik turun adalah halte tempat kamu akan diturunkan. Setiap rute memiliki beberapa halte yang bisa dipilih.',
  },
  {
    icon: CreditCard,
    category: 'Pembayaran',
    q: 'Metode pembayaran apa saja yang tersedia?',
    a: 'Saat ini pembayaran dilakukan melalui transfer bank atau e-wallet sesuai yang tersedia di halaman konfirmasi. Kami terus menambahkan metode pembayaran baru.',
  },
  {
    icon: CreditCard,
    category: 'Pembayaran',
    q: 'Apakah harga sudah termasuk pajak?',
    a: 'Ya, harga yang tertera sudah merupakan harga final yang harus dibayarkan. Tidak ada biaya tambahan.',
  },
  {
    icon: Ban,
    category: 'Pembatalan',
    q: 'Bagaimana cara membatalkan pesanan?',
    a: 'Buka halaman "Pesanan", pilih pesanan yang ingin dibatalkan, lalu tekan tombol "Batalkan Pesanan". Pembatalan hanya bisa dilakukan sebelum waktu keberangkatan.',
  },
  {
    icon: Ban,
    category: 'Pembatalan',
    q: 'Apakah ada biaya pembatalan?',
    a: 'Kebijakan pembatalan dan pengembalian dana tergantung pada masing-masing operator shuttle. Silakan hubungi operator terkait untuk informasi lebih lanjut.',
  },
  {
    icon: Clock,
    category: 'Perjalanan',
    q: 'Berapa lama waktu perjalanan?',
    a: 'Waktu perjalanan bervariasi tergantung rute dan kondisi lalu lintas. Estimasi waktu ditampilkan pada jadwal di hasil pencarian.',
  },
  {
    icon: Clock,
    category: 'Perjalanan',
    q: 'Apa yang harus saya lakukan jika shuttle terlambat?',
    a: 'Jika shuttle terlambat, silakan hubungi operator terkait melalui informasi kontak yang tersedia di detail pesanan Anda.',
  },
  {
    icon: HelpCircle,
    category: 'Akun',
    q: 'Bagaimana cara mengubah data profil?',
    a: 'Saat ini perubahan data profil dapat dilakukan dengan menghubungi layanan pelanggan kami. Fitur edit profil akan segera hadir.',
  },
  {
    icon: HelpCircle,
    category: 'Akun',
    q: 'Lupa password, bagaimana?',
    a: 'Silakan hubungi layanan pelanggan kami melalui email support@transity.web.id untuk reset password akun Anda.',
  },
];

export default function HelpPage() {
  const { goBack } = useNav();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const filtered = faqs.filter(f =>
    f.q.toLowerCase().includes(query.toLowerCase()) ||
    f.a.toLowerCase().includes(query.toLowerCase()) ||
    f.category.toLowerCase().includes(query.toLowerCase())
  );

  const categories = [...new Set(filtered.map(f => f.category))];

  return (
    <div className="anim-fade min-h-screen bg-[#f8fafa] safe-pb-24">
      <PageHeader title="Bantuan & FAQ" onBack={goBack} className="pb-6">
        <div className="relative mt-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari pertanyaan..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/10 border border-white/15 text-[14px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
          />
        </div>
      </PageHeader>

      <div className="px-4 pt-2">
        {categories.map(cat => (
          <div key={cat} className="mb-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">{cat}</p>
            <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
              {filtered.filter(f => f.category === cat).map((faq, i) => {
                const globalIdx = faqs.indexOf(faq);
                const isOpen = openIdx === globalIdx;
                return (
                  <div key={globalIdx} className={cn(i > 0 && 'border-t border-slate-50')}>
                    <button
                      onClick={() => setOpenIdx(isOpen ? null : globalIdx)}
                      className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50/50 transition-colors text-left"
                    >
                      <faq.icon className="w-[18px] h-[18px] text-teal-600 mt-0.5 shrink-0" />
                      <span className="flex-1 text-[14px] font-medium text-slate-700">{faq.q}</span>
                      <ChevronDown className={cn(
                        'w-4 h-4 text-slate-300 shrink-0 mt-0.5 transition-transform duration-300',
                        isOpen && 'rotate-180',
                      )} />
                    </button>
                    <div className={cn(
                      'overflow-hidden transition-all duration-300',
                      isOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0',
                    )}>
                      <p className="px-4 pb-4 pl-[46px] text-[13px] leading-relaxed text-slate-500">{faq.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <HelpCircle className="w-12 h-12 text-slate-200" />
            <p className="text-[14px] text-slate-400">Tidak ada pertanyaan yang cocok</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-soft p-5 mt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-slate-700">Butuh bantuan lain?</p>
              <p className="text-[12px] text-slate-400">Tim kami siap membantu</p>
            </div>
          </div>
          <a
            href="mailto:support@transity.web.id"
            className="block w-full h-11 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-white text-[13px] font-bold text-center leading-[44px] transition-colors"
          >
            Hubungi Kami
          </a>
        </div>
      </div>
    </div>
  );
}
