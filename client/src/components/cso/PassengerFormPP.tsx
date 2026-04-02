import { useState, useEffect } from 'react';
import { Check, ArrowRight, MapPin } from 'lucide-react';
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

const formatTime = (isoString: string | null | undefined): string => {
  if (!isoString) return '--:--';
  try {
    return new Date(isoString).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
    });
  } catch { return '--:--'; }
};

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
  onNext,
}: PassengerFormPPProps) {
  const [formData, setFormData] = useState<Array<{ fullName: string; phone: string; idNumber: string }>>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFormData(
      outboundSeats.map((_, i) => ({
        fullName: passengers[i]?.name || '',
        phone: '',
        idNumber: '',
      }))
    );
  }, [outboundSeats.length]);

  const handleInputChange = (index: number, field: 'fullName' | 'phone' | 'idNumber', value: string) => {
    const updated = formData.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    );
    setFormData(updated);
    onPassengersChange(updated.map((p, i) => ({
      name: p.fullName,
      seatNoOutbound: outboundSeats[i],
      seatNoReturn: returnSeats[i],
    })));
  };

  const markTouched = (key: string) => setTouched(prev => ({ ...prev, [key]: true }));

  const getNameError = (name: string, key: string): string | null => {
    if (!touched[key]) return null;
    if (!name.trim()) return 'Wajib diisi';
    if (name.trim().length < 3) return 'Min. 3 karakter';
    return null;
  };

  const getPhoneError = (phone: string, key: string): string | null => {
    if (!touched[key] || !phone) return null;
    if (!/^0[0-9]{9,12}$/.test(phone)) return 'Format: 08xxxxxxxxxx';
    return null;
  };

  const filledCount = formData.filter(p => p.fullName.trim().length >= 3).length;
  const isFormValid = formData.length > 0 && formData.every(p => p.fullName.trim().length >= 3);

  const MAX_VISIBLE = 4;
  const FORM_CARD_HEIGHT = 118;
  const formContainerMaxH = outboundSeats.length > MAX_VISIBLE
    ? FORM_CARD_HEIGHT * MAX_VISIBLE + 30
    : undefined;

  return (
    <div className="h-full flex flex-col gap-0 overflow-hidden">
      {/* Trip summary header */}
      <div className="flex-shrink-0 grid grid-cols-2 gap-2 px-3 md:px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="bg-white border border-blue-100 rounded-xl p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Pergi</span>
            <span className="text-[10px] font-semibold text-gray-400 font-mono">{formatTime(outboundTrip.departAtAtOutlet)}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-700 truncate">
            <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
            <span className="truncate">{outboundOriginStop.name}</span>
            <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
            <span className="truncate">{outboundDestinationStop.name}</span>
          </div>
        </div>
        <div className="bg-white border border-emerald-100 rounded-xl p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Pulang</span>
            <span className="text-[10px] font-semibold text-gray-400 font-mono">{formatTime(returnTrip.departAtAtOutlet)}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-700 truncate">
            <MapPin className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{returnOriginStop.name}</span>
            <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
            <span className="truncate">{returnDestinationStop.name}</span>
          </div>
        </div>
      </div>

      {/* Passenger list */}
      <div className="flex-1 overflow-y-auto px-3 md:px-5 py-3">
        <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-800">Data Penumpang</h3>
            <p className="text-[11px] text-gray-400">{filledCount}/{outboundSeats.length} terisi</p>
          </div>
          {outboundSeats.length > MAX_VISIBLE && (
            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
              Scroll untuk lihat semua
            </span>
          )}
        </div>

        <div
          className="space-y-2"
          style={formContainerMaxH ? { maxHeight: `${formContainerMaxH}px`, overflowY: 'auto' } : undefined}
        >
          {formData.map((passenger, index) => {
            const nameKey = `name-${index}`;
            const phoneKey = `phone-${index}`;
            const nameError = getNameError(passenger.fullName, nameKey);
            const phoneError = getPhoneError(passenger.phone, phoneKey);
            const isFilled = passenger.fullName.trim().length >= 3;

            return (
              <div
                key={index}
                className={`border rounded-xl p-3 transition-colors ${
                  isFilled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                }`}
                data-testid={`passenger-form-pp-${index}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${
                      isFilled ? 'bg-emerald-100' : 'bg-blue-100'
                    }`}>
                      {isFilled
                        ? <Check className="w-3 h-3 text-emerald-600" />
                        : <span className="text-[10px] font-bold text-blue-600">{index + 1}</span>
                      }
                    </div>
                    <span className="text-xs font-semibold text-gray-700">Penumpang {index + 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-mono font-bold">
                      {outboundSeats[index]}
                    </span>
                    <ArrowRight className="w-2.5 h-2.5 text-gray-300" />
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-mono font-bold">
                      {returnSeats[index]}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-[2]">
                    <input
                      value={passenger.fullName}
                      onChange={(e) => handleInputChange(index, 'fullName', e.target.value)}
                      onBlur={() => markTouched(nameKey)}
                      placeholder="Nama lengkap *"
                      className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                        nameError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
                      }`}
                      data-testid={`input-name-pp-${index}`}
                    />
                    {nameError && <p className="text-[10px] text-red-500 mt-0.5">{nameError}</p>}
                  </div>
                  <div className="flex-1">
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={passenger.phone}
                      onChange={(e) => handleInputChange(index, 'phone', e.target.value.replace(/[^0-9]/g, ''))}
                      onBlur={() => markTouched(phoneKey)}
                      placeholder="Telepon"
                      className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                        phoneError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
                      }`}
                      data-testid={`input-phone-pp-${index}`}
                    />
                    {phoneError && <p className="text-[10px] text-red-500 mt-0.5">{phoneError}</p>}
                  </div>
                  <div className="flex-1">
                    <input
                      value={passenger.idNumber}
                      onChange={(e) => handleInputChange(index, 'idNumber', e.target.value)}
                      placeholder="KTP/Paspor"
                      className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                      data-testid={`input-id-pp-${index}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 px-3 md:px-5 py-3 border-t border-gray-100 bg-white flex gap-2">
        <button
          onClick={onBack}
          className="h-10 px-4 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm flex items-center gap-1.5 hover:bg-gray-200 transition-colors"
          data-testid="btn-pax-pp-back"
        >
          Kembali
        </button>
        <button
          onClick={onNext}
          disabled={!isFormValid}
          className="flex-1 h-10 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          data-testid="btn-pax-pp-next"
        >
          Lanjut ke Pembayaran
        </button>
      </div>
    </div>
  );
}
