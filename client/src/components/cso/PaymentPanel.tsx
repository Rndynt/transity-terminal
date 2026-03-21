import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Tag, X, Check, AlertCircle } from 'lucide-react';

interface PaymentPanelProps {
  totalAmount: number;
  payment?: { method: string; amount: number } | null;
  onPaymentUpdate: (payment: { method: string; amount: number }) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading?: boolean;
  promoCode?: string;
  discountAmount?: number;
  promoValidation?: { valid: boolean; discountAmount: number; promotion?: any; error?: string };
  onApplyPromo?: (code: string) => Promise<void>;
  onClearPromo?: () => void;
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
  loading = false,
  promoCode,
  discountAmount = 0,
  promoValidation,
  onApplyPromo,
  onClearPromo,
}: PaymentPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>(payment?.method || '');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  const finalAmount = totalAmount - discountAmount;

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    onPaymentUpdate({ method, amount: finalAmount });
  };

  const change = selectedMethod === 'cash' && cashReceived 
    ? Math.max(0, parseFloat(cashReceived) - finalAmount) 
    : 0;

  const handleSubmit = () => {
    if (!selectedMethod) return;
    if (selectedMethod === 'cash' && parseFloat(cashReceived) < finalAmount) return;
    onPaymentUpdate({ method: selectedMethod, amount: finalAmount });
    onSubmit();
  };

  const isValid = () => {
    if (!selectedMethod) return false;
    if (selectedMethod === 'cash') {
      return parseFloat(cashReceived) >= finalAmount;
    }
    return true;
  };

  const handleApplyPromo = async () => {
    if (!promoInput.trim() || !onApplyPromo) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      await onApplyPromo(promoInput.trim());
      setPromoInput('');
    } catch (err: any) {
      setPromoError(err.message || 'Kode promo tidak valid');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleClearPromo = () => {
    onClearPromo?.();
    setPromoInput('');
    setPromoError('');
    if (selectedMethod) {
      onPaymentUpdate({ method: selectedMethod, amount: totalAmount });
    }
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-4">
      {onApplyPromo && (
        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> Kode Promo / Voucher
          </Label>
          {promoCode ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="font-mono font-semibold text-green-700" data-testid="text-applied-promo">{promoCode}</span>
                <Badge variant="secondary" className="text-xs">
                  -{formatCurrency(discountAmount)}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClearPromo} data-testid="btn-clear-promo">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={promoInput}
                onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                placeholder="Masukkan kode promo"
                className="font-mono flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                data-testid="input-promo-code"
              />
              <Button
                variant="outline"
                onClick={handleApplyPromo}
                disabled={!promoInput.trim() || promoLoading}
                data-testid="btn-apply-promo"
              >
                {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pakai'}
              </Button>
            </div>
          )}
          {promoError && (
            <div className="flex items-center gap-1.5 text-xs text-red-600" data-testid="text-promo-error">
              <AlertCircle className="w-3.5 h-3.5" />
              {promoError}
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-primary/5 rounded-lg space-y-2">
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatCurrency(totalAmount)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between items-center text-sm text-green-600">
            <span>Diskon</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-1 border-t border-primary/10">
          <span className="text-lg">Total Pembayaran</span>
          <span className="text-2xl font-bold text-primary" data-testid="text-final-amount">{formatCurrency(finalAmount)}</span>
        </div>
      </div>

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
              data-testid={`btn-payment-method-${method.id}`}
            >
              <span className="font-medium">{method.label}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedMethod === 'cash' && (
        <div>
          <Label htmlFor="cashReceived" className="text-sm mb-2 block">Jumlah Uang Diterima</Label>
          <Input
            id="cashReceived"
            type="number"
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
            placeholder="Masukkan nominal"
            data-testid="input-cash-received"
          />
          {cashReceived && parseFloat(cashReceived) >= finalAmount && (
            <div className="mt-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              Kembalian: <strong>{formatCurrency(change)}</strong>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1" disabled={loading} data-testid="btn-payment-back">
          Kembali
        </Button>
        <Button onClick={handleSubmit} disabled={!isValid() || loading} className="flex-1" data-testid="btn-pay-now">
          {loading ? 'Memproses...' : 'Bayar Sekarang'}
        </Button>
      </div>
    </div>
  );
}
