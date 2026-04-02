import { useState, useEffect } from 'react';
import { User, MapPin, ChevronLeft, ChevronRight, ArrowRight, Check } from 'lucide-react';
import type { Stop, CsoAvailableTrip } from '@/types';

interface PassengerFormPPProps {
  outboundTrip: CsoAvailableTrip;
  outboundSeats: string[];
  outboundOriginStop: Stop;
  outboundDestinationStop: Stop;
  returnTrip: CsoAvailableTrip;
  returnSeats: string[];
  returnOriginStop: Stop;
  returnDestinationStop: Stop;
  passengers: { name: string; seatNoOutbound: string; seatNoReturn: string }[];
  onPassengersChange: (pax: { name: string; seatNoOutbound: string; seatNoReturn: string }[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function PassengerFormPP({
  outboundTrip,
  outboundSeats,
  outboundOriginStop,
  outboundDestinationStop,
  returnTrip,
  returnSeats,
  returnOriginStop,
  returnDestinationStop,
  passengers,
  onPassengersChange,
  onBack,
  onNext
}: PassengerFormPPProps) {
  const [formData, setFormData] = useState<string[]>([]);

  useEffect(() => {
    if (passengers.length > 0 && formData.length === 0) {
      setFormData(passengers.map(p => p.name));
    } else if (formData.length === 0) {
      setFormData(new Array(outboundSeats.length).fill(''));
    }
  }, [outboundSeats.length, passengers]);

  const handleNameChange = (index: number, name: string) => {
    const updated = [...formData];
    updated[index] = name;
    setFormData(updated);
    
    const paxUpdates = updated.map((n, i) => ({
      name: n,
      seatNoOutbound: outboundSeats[i],
      seatNoReturn: returnSeats[i]
    }));
    onPassengersChange(paxUpdates);
  };

  const isFormValid = formData.length > 0 && formData.every(n => n.trim().length >= 3);

  const formatTime = (isoString: string | null): string => {
    if (!isoString) return '--:--';
    try {
      return new Date(isoString).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
      });
    } catch { return '--:--'; }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-gray-100 p-4">
        <h2 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-tight flex items-center gap-2">
          <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
          Data Penumpang Pulang Pergi
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Perjalanan Pergi</span>
              <span className="text-[10px] font-bold text-blue-500">{formatTime(outboundTrip.departAtAtOutlet)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 truncate">
              <MapPin className="w-3.5 h-3.5 text-blue-500" />
              {outboundOriginStop.name}
              <ArrowRight className="w-3 h-3 text-gray-400" />
              {outboundDestinationStop.name}
            </div>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Perjalanan Pulang</span>
              <span className="text-[10px] font-bold text-emerald-500">{formatTime(returnTrip.departAtAtOutlet)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 truncate">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              {returnOriginStop.name}
              <ArrowRight className="w-3 h-3 text-gray-400" />
              {returnDestinationStop.name}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {formData.map((name, index) => (
          <div key={index} className="bg-gray-50 border border-gray-200 rounded-3xl p-4 transition-all hover:border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${name.trim().length >= 3 ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'}`}>
                  {name.trim().length >= 3 ? <Check className="w-3 h-3" /> : index + 1}
                </div>
                <span className="text-xs font-bold text-gray-700">Penumpang {index + 1}</span>
              </div>
              <div className="flex gap-2">
                <div className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-black uppercase tracking-tighter">
                  Pergi: {outboundSeats[index]}
                </div>
                <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase tracking-tighter">
                  Pulang: {returnSeats[index]}
                </div>
              </div>
            </div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                placeholder="Masukkan nama lengkap penumpang *"
                className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                data-testid={`input-pax-name-${index}`}
              />
            </div>
            {name && name.trim().length < 3 && (
              <p className="text-[10px] text-red-500 mt-1.5 ml-2 font-medium italic">Min. 3 karakter</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="h-11 px-6 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-gray-200"
          data-testid="btn-pax-pp-back"
        >
          <ChevronLeft className="w-4 h-4" /> Kembali
        </button>
        <button
          onClick={onNext}
          disabled={!isFormValid}
          className="h-11 px-8 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-100"
          data-testid="btn-pax-pp-next"
        >
          Lanjut Review <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
