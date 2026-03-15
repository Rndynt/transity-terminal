import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Check, CreditCard, Clock, Loader2, Banknote, QrCode, Wallet, Building2 } from 'lucide-react';

interface PassengerData { fullName: string; phone?: string; idNumber?: string; seatNo: string }

interface PassengerFormProps {
  selectedSeats: string[];
  passengers: Array<PassengerData>;
  onPassengersUpdate: (passengers: Array<PassengerData>) => void;
  totalAmount: number;
  onBook: (passengers: Array<PassengerData>) => void;
  onPay: (passengers: Array<PassengerData>, payment: { method: string; amount: number }) => void;
  onPaymentUpdate: (payment: { method: string; amount: number }) => void;
  payment?: { method: string; amount: number } | null;
  onBack: () => void;
  loading?: boolean;
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'qr', label: 'QRIS', icon: QrCode },
  { id: 'ewallet', label: 'E-Wallet', icon: Wallet },
  { id: 'bank', label: 'Transfer', icon: Building2 },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

export default function PassengerForm({
  selectedSeats,
  passengers,
  onPassengersUpdate,
  totalAmount,
  onBook,
  onPay,
  onPaymentUpdate,
  payment,
  onBack,
  loading = false
}: PassengerFormProps) {
  const [formData, setFormData] = useState<Array<{ fullName: string; phone: string; idNumber: string; seatNo: string }>>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>(payment?.method || '');
  const [cashReceived, setCashReceived] = useState<string>('');

  useEffect(() => {
    setFormData(prev => {
      const existing = new Map(prev.map(p => [p.seatNo, p]));
      return selectedSeats.map(seatNo =>
        existing.get(seatNo) || {
          fullName: passengers.find(p => p.seatNo === seatNo)?.fullName || '',
          phone: passengers.find(p => p.seatNo === seatNo)?.phone || '',
          idNumber: passengers.find(p => p.seatNo === seatNo)?.idNumber || '',
          seatNo
        }
      );
    });
  }, [selectedSeats]);

  const handleInputChange = (index: number, field: 'fullName' | 'phone' | 'idNumber', value: string) => {
    setFormData(current => {
      const updated = [...current];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    onPaymentUpdate({ method, amount: totalAmount });
  };

  const filledCount = formData.filter(p => p.fullName.trim().length >= 2).length;
  const isPassengerValid = formData.length > 0 && formData.every(p => p.fullName.trim().length >= 2);

  const isPaymentValid = () => {
    if (!selectedMethod) return false;
    if (selectedMethod === 'cash') {
      return parseFloat(cashReceived) >= totalAmount;
    }
    return true;
  };

  const cashChange = selectedMethod === 'cash' && cashReceived
    ? Math.max(0, parseFloat(cashReceived) - totalAmount)
    : 0;

  const handleBookOnly = () => {
    if (!isPassengerValid) return;
    onPassengersUpdate(formData);
    onBook(formData);
  };

  const handlePayAndPrint = () => {
    if (!isPassengerValid || !isPaymentValid()) return;
    onPassengersUpdate(formData);
    onPay(formData, { method: selectedMethod, amount: totalAmount });
  };

  const MAX_VISIBLE = 4;
  const FORM_CARD_HEIGHT = 76;
  const formContainerMaxH = selectedSeats.length > MAX_VISIBLE
    ? FORM_CARD_HEIGHT * MAX_VISIBLE + 24
    : undefined;

  if (selectedSeats.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Tidak ada kursi yang dipilih</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-0">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Data Penumpang</h3>
          <p className="text-[11px] text-muted-foreground">{filledCount}/{selectedSeats.length} terisi</p>
        </div>
        {selectedSeats.length > MAX_VISIBLE && (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
            Scroll untuk lihat semua
          </span>
        )}
      </div>

      <div
        className="space-y-2 overflow-y-auto flex-shrink-0 pr-1"
        style={formContainerMaxH ? { maxHeight: `${formContainerMaxH}px` } : undefined}
      >
        {formData.map((passenger, index) => {
          const isFilled = passenger.fullName.trim().length >= 2;
          return (
            <div
              key={passenger.seatNo}
              className={`border rounded-xl p-3 transition-colors ${
                isFilled ? 'bg-green-50/50 border-green-200' : 'bg-muted/30 border-border'
              }`}
              data-testid={`passenger-form-${index}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded flex items-center justify-center ${
                    isFilled ? 'bg-green-100' : 'bg-primary/10'
                  }`}>
                    {isFilled
                      ? <Check className="w-3 h-3 text-green-600" />
                      : <span className="text-[10px] font-bold text-primary">{index + 1}</span>
                    }
                  </div>
                  <span className="text-xs font-semibold text-gray-700">Penumpang {index + 1}</span>
                </div>
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-mono font-bold">
                  {passenger.seatNo}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-[2]">
                  <Input
                    value={passenger.fullName}
                    onChange={(e) => handleInputChange(index, 'fullName', e.target.value)}
                    placeholder="Nama lengkap *"
                    className="h-8 text-sm"
                    data-testid={`input-name-${index}`}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={passenger.phone}
                    onChange={(e) => handleInputChange(index, 'phone', e.target.value)}
                    placeholder="Telepon"
                    className="h-8 text-sm"
                    data-testid={`input-phone-${index}`}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={passenger.idNumber}
                    onChange={(e) => handleInputChange(index, 'idNumber', e.target.value)}
                    placeholder="KTP/Paspor"
                    className="h-8 text-sm"
                    data-testid={`input-id-${index}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-3 mt-3 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Pembayaran</h3>
          <span className="text-[10px] text-muted-foreground">{selectedSeats.length} penumpang</span>
        </div>

        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-3 py-2 flex items-center justify-between border-b">
            <span className="text-xs text-muted-foreground">Jumlah kursi</span>
            <span className="text-xs font-semibold text-gray-700">{selectedSeats.length} kursi</span>
          </div>
          <div className="px-3 py-2.5 flex items-center justify-between bg-primary/5">
            <span className="text-sm font-bold text-gray-700">Total</span>
            <span className="text-lg font-black text-primary font-mono">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Metode Pembayaran</p>
          <div className="grid grid-cols-4 gap-1.5">
            {PAYMENT_METHODS.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => handleMethodSelect(m.id)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    selectedMethod === m.id
                      ? 'bg-primary/10 border-primary ring-1 ring-primary/20'
                      : 'bg-card border-border hover:border-primary/30'
                  }`}
                  data-testid={`pay-${m.id}`}
                >
                  <Icon className={`w-4 h-4 mx-auto mb-0.5 ${selectedMethod === m.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-[10px] font-medium ${selectedMethod === m.id ? 'text-primary' : 'text-muted-foreground'}`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedMethod === 'cash' && (
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                Uang Diterima
              </label>
              <Input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="Masukkan jumlah..."
                className="h-9 font-mono"
                data-testid="input-cash"
              />
            </div>
            {parseFloat(cashReceived) >= totalAmount && (
              <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                <span className="text-[10px] text-muted-foreground block">Kembalian</span>
                <span className="text-lg font-black text-green-600 font-mono">{formatCurrency(cashChange)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-3 mt-auto border-t flex-shrink-0">
        <button
          onClick={handleBookOnly}
          disabled={!isPassengerValid || loading}
          className="flex-1 h-10 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="btn-book-only"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
          Booking Saja
        </button>
        <button
          onClick={handlePayAndPrint}
          disabled={!isPassengerValid || !isPaymentValid() || loading}
          className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="btn-pay-confirm"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
          Bayar & Cetak
        </button>
      </div>
    </div>
  );
}
