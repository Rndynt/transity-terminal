import { ArrowRight, Percent } from 'lucide-react';
import { useNav } from '@/App';

interface RouteDeal {
  id: string;
  fromOutlet: string;
  fromCity: string;
  toOutlet: string;
  toCity: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
}

const ROUTE_DEALS: RouteDeal[] = [
  {
    id: 'rd-1',
    fromOutlet: 'Dipatiukur',
    fromCity: 'Bandung',
    toOutlet: 'Daan Mogot Grogol',
    toCity: 'Jakarta',
    originalPrice: 120000,
    discountedPrice: 85000,
    discountPercent: 29,
  },
  {
    id: 'rd-2',
    fromOutlet: 'Atrium Senen',
    fromCity: 'Jakarta',
    toOutlet: 'Buah Batu',
    toCity: 'Bandung',
    originalPrice: 120000,
    discountedPrice: 90000,
    discountPercent: 25,
  },
  {
    id: 'rd-3',
    fromOutlet: 'Cempaka Putih',
    fromCity: 'Jakarta',
    toOutlet: 'Simpang Lima',
    toCity: 'Semarang',
    originalPrice: 200000,
    discountedPrice: 150000,
    discountPercent: 25,
  },
  {
    id: 'rd-4',
    fromOutlet: 'Pasteur',
    fromCity: 'Bandung',
    toOutlet: 'Cempaka Putih',
    toCity: 'Jakarta',
    originalPrice: 110000,
    discountedPrice: 80000,
    discountPercent: 27,
  },
];

function fmtPrice(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function DealCard({ deal, onTap }: { deal: RouteDeal; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className="snap-start shrink-0 w-[200px] text-left active:scale-[0.97] transition-transform duration-200"
    >
      <div
        className="bg-white rounded-2xl overflow-hidden h-full relative"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
      >
        <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-bl-xl">
          -{deal.discountPercent}%
        </div>

        <div className="p-3.5 pt-4">
          <div className="flex items-start gap-2.5">
            <div className="flex flex-col items-center pt-[3px] gap-[3px] shrink-0">
              <div className="w-[7px] h-[7px] rounded-full border-[1.5px] border-teal-500" />
              <div className="w-[1.5px] h-7 bg-gradient-to-b from-teal-400 to-emerald-400 rounded-full" />
              <div className="w-[7px] h-[7px] rounded-full bg-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-slate-800 leading-tight truncate">{deal.fromOutlet}</p>
              <p className="text-[10px] text-slate-400 mb-2.5">{deal.fromCity}</p>
              <p className="text-[12px] font-bold text-slate-800 leading-tight truncate">{deal.toOutlet}</p>
              <p className="text-[10px] text-slate-400">{deal.toCity}</p>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 line-through">{fmtPrice(deal.originalPrice)}</span>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-[17px] font-display font-extrabold text-teal-700 leading-none">{fmtPrice(deal.discountedPrice)}</span>
                <span className="text-[9px] text-slate-400"> /orang</span>
              </div>
              <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5 text-teal-600" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function RouteDealsSection() {
  const { navigate } = useNav();

  const handleTap = (deal: RouteDeal) => {
    sessionStorage.setItem('t_origin', deal.fromCity);
    sessionStorage.setItem('t_dest', deal.toCity);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    navigate({
      name: 'search-results',
      originCity: deal.fromCity,
      destinationCity: deal.toCity,
      date: today,
      passengers: 1,
    });
  };

  return (
    <div className="mt-6 anim-slide-up delay-2">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-emerald-500 flex items-center justify-center shadow-sm">
            <Percent className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-[14px] font-bold text-slate-800">Diskon Rute</h3>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 snap-x snap-mandatory">
        {ROUTE_DEALS.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onTap={() => handleTap(deal)}
          />
        ))}
      </div>
    </div>
  );
}
