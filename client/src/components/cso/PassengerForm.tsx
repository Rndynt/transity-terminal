import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Clock, ArrowLeft, Loader2 } from 'lucide-react';

interface PassengerFormProps {
  selectedSeats: string[];
  passengers: Array<{ fullName: string; phone?: string; idNumber?: string; seatNo: string }>;
  onPassengersUpdate: (passengers: Array<{ fullName: string; phone?: string; idNumber?: string; seatNo: string }>) => void;
  onBook: () => void;
  onPay: () => void;
  onBack: () => void;
  loading?: boolean;
}

export default function PassengerForm({
  selectedSeats,
  passengers,
  onPassengersUpdate,
  onBook,
  onPay,
  onBack,
  loading = false
}: PassengerFormProps) {
  const [formData, setFormData] = useState<Array<{ fullName: string; phone: string; idNumber: string; seatNo: string }>>([]);

  // Initialize form when selectedSeats changes
  useEffect(() => {
    const initialData = selectedSeats.map(seatNo => {
      const existing = passengers.find(p => p.seatNo === seatNo);
      return {
        fullName: existing?.fullName || '',
        phone: existing?.phone || '',
        idNumber: existing?.idNumber || '',
        seatNo
      };
    });
    setFormData(initialData);
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

  const isValid = () => {
    if (formData.length === 0) return false;
    return formData.every(p => p.fullName.trim().length >= 2);
  };

  const handleAction = (action: 'book' | 'pay') => {
    if (!isValid()) return;
    onPassengersUpdate(formData);
    if (action === 'book') {
      onBook();
    } else {
      onPay();
    }
  };

  if (selectedSeats.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Tidak ada kursi yang dipilih</p>
        <Button variant="outline" className="mt-4" onClick={onBack}>Kembali pilih kursi</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Mengisi data untuk <strong>{selectedSeats.length} penumpang</strong>
      </div>

      {formData.map((passenger, index) => (
        <div key={passenger.seatNo} className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Penumpang {index + 1}</h4>
            <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
              Kursi {passenger.seatNo}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label htmlFor={`name-${index}`} className="text-sm">Nama Lengkap *</Label>
              <Input
                id={`name-${index}`}
                value={passenger.fullName}
                onChange={(e) => handleInputChange(index, 'fullName', e.target.value)}
                placeholder="Nama lengkap"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor={`phone-${index}`} className="text-sm">No. Telepon</Label>
              <Input
                id={`phone-${index}`}
                value={passenger.phone}
                onChange={(e) => handleInputChange(index, 'phone', e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor={`id-${index}`} className="text-sm">No. Identitas</Label>
              <Input
                id={`id-${index}`}
                value={passenger.idNumber}
                onChange={(e) => handleInputChange(index, 'idNumber', e.target.value)}
                placeholder="KTP/Paspor"
                className="mt-1"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Action Buttons */}
      <div className="border-t pt-4 mt-4">
        <p className="text-sm text-muted-foreground mb-3">
          Pilih aksi setelah mengisi data penumpang:
        </p>
        <div className="flex flex-col gap-2">
          <Button 
            onClick={() => handleAction('pay')} 
            disabled={!isValid() || loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4 mr-2" />
            )}
            Bayar Sekarang
          </Button>
          <Button 
            variant="secondary"
            onClick={() => handleAction('book')} 
            disabled={!isValid() || loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Clock className="w-4 h-4 mr-2" />
            )}
            Booking Saja (Belum Bayar)
          </Button>
        </div>
        <Button variant="ghost" onClick={onBack} className="w-full mt-2" disabled={loading}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>
      </div>
    </div>
  );
}
