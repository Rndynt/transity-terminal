import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface PaymentPanelProps {
  totalAmount: number;
  payment?: { method: string; amount: number } | null;
  onPaymentUpdate: (payment: { method: string; amount: number }) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading?: boolean;
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tunai', icon: '.money' },
  { id: 'qr', label: 'QRIS', icon: 'qr' },
  { id: 'ewallet', label: 'E-Wallet', icon: 'wallet' },
  { id: 'bank', label: 'Transfer Bank', icon: 'bank' },
];

export default function PaymentPanel({
  totalAmount,
  payment,
  onPaymentUpdate,
  onSubmit,
  onBack,
  loading = false
}: PaymentPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>(payment?.method || '');
  const [cashReceived, setCashReceived] = useState<string>('');

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    onPaymentUpdate({ method, amount: totalAmount });
  };

  const change = selectedMethod === 'cash' && cashReceived 
    ? Math.max(0, parseFloat(cashReceived) - totalAmount) 
    : 0;

  const handleSubmit = () => {
    if (!selectedMethod) return;
    if (selectedMethod === 'cash' && parseFloat(cashReceived) < totalAmount) return;
    onSubmit();
  };

  const isValid = () => {
    if (!selectedMethod) return false;
    if (selectedMethod === 'cash') {
      return parseFloat(cashReceived) >= totalAmount;
    }
    return true;
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-4">
      {/* Total */}
      <div className="p-4 bg-primary/5 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-lg">Total Pembayaran</span>
          <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      {/* Payment Methods */}
      <div>
        <Label className="text-sm mb-2 block">Pilih Metode Pembayaran</Label>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map(method => (
            <button
              key={method.id}
              onClick={() => handleMethodSelect(method.id)}
              className={`p-3 border rounded-lg text-left transition-colors ${
                selectedMethod === method.id 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <span className="font-medium">{method.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cash Input */}
      {selectedMethod === 'cash' && (
        <div>
          <Label htmlFor="cashReceived" className="text-sm mb-2 block">Jumlah Uang Diterima</Label>
          <Input
            id="cashReceived"
            type="number"
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
            placeholder="Masukkan nominal"
          />
          {cashReceived && parseFloat(cashReceived) >= totalAmount && (
            <div className="mt-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              Kembalian: <strong>{formatCurrency(change)}</strong>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1" disabled={loading}>
          Kembali
        </Button>
        <Button onClick={handleSubmit} disabled={!isValid() || loading} className="flex-1">
          {loading ? 'Memproses...' : 'Bayar Sekarang'}
        </Button>
      </div>
    </div>
  );
}