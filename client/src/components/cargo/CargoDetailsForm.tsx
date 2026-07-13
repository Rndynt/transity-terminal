import { useState } from 'react';
import { Package, User, Hash, Weight, Ruler, ShieldCheck } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { CargoType } from '@/types';

/**
 * Shared shape for the "Pengirim / Penerima / Detail Barang" section of a
 * cargo shipment form. Used by both the CSO quick-cargo panel and the Cargo
 * Terminal page so the two flows always render (and validate) the same form.
 */
export interface CargoDetailsValue {
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  cargoTypeId: string;
  itemDescription: string;
  quantity: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  declaredValue: string;
  notes: string;
}

export const EMPTY_CARGO_DETAILS: CargoDetailsValue = {
  senderName: '',
  senderPhone: '',
  recipientName: '',
  recipientPhone: '',
  cargoTypeId: '',
  itemDescription: '',
  quantity: '1',
  weightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  declaredValue: '',
  notes: '',
};

const PHONE_REGEX = /^0[0-9]{9,12}$/;

export function isCargoDetailsValid(
  value: CargoDetailsValue,
  opts: { cargoTypeRequired?: boolean } = {}
): boolean {
  const valid =
    value.senderName.trim().length >= 2 &&
    PHONE_REGEX.test(value.senderPhone.trim()) &&
    value.recipientName.trim().length >= 2 &&
    PHONE_REGEX.test(value.recipientPhone.trim()) &&
    value.itemDescription.trim().length >= 2 &&
    parseInt(value.quantity || '0', 10) > 0;

  if (opts.cargoTypeRequired && !value.cargoTypeId) return false;
  return valid;
}

interface CargoDetailsFormProps {
  value: CargoDetailsValue;
  onChange: (patch: Partial<CargoDetailsValue>) => void;
  cargoTypes: CargoType[];
  /** Whether "Jenis Kargo" must be selected before the form is considered valid (Cargo Terminal requires it to quote a tariff; CSO does not). */
  cargoTypeRequired?: boolean;
}

/**
 * Reusable Pengirim / Penerima / Detail Barang section for cargo shipment
 * forms. Keep this component the single source of truth for those fields —
 * any change here applies to both the CSO quick-cargo panel and the Cargo
 * Terminal page.
 */
export default function CargoDetailsForm({ value, onChange, cargoTypes, cargoTypeRequired = false }: CargoDetailsFormProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (key: string) => setTouched(prev => ({ ...prev, [key]: true }));

  const getError = (val: string, key: string, minLen = 2) => {
    if (!touched[key]) return null;
    if (!val.trim()) return 'Wajib diisi';
    if (val.trim().length < minLen) return `Min. ${minLen} karakter`;
    return null;
  };

  const getPhoneError = (phone: string, key: string) => {
    if (!touched[key]) return null;
    if (!phone.trim()) return 'Wajib diisi';
    if (!PHONE_REGEX.test(phone)) return 'Format: 08xxxxxxxxxx';
    return null;
  };

  const activeCargoTypes = cargoTypes.filter(ct => ct.isActive !== false);

  return (
    <div className="space-y-3">
      <div className="border rounded-xl p-3 bg-amber-50/50 border-amber-200">
        <div className="flex items-center gap-1.5 mb-2">
          <User className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-gray-700">Pengirim</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-[2]">
            <input
              value={value.senderName}
              onChange={(e) => onChange({ senderName: e.target.value })}
              onBlur={() => markTouched('senderName')}
              placeholder="Nama pengirim *"
              className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                getError(value.senderName, 'senderName') ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-amber-200 focus:border-amber-300'
              }`}
              data-testid="input-sender-name"
            />
            {getError(value.senderName, 'senderName') && <p className="text-[10px] text-red-500 mt-0.5">{getError(value.senderName, 'senderName')}</p>}
          </div>
          <div className="flex-1">
            <input
              type="tel"
              inputMode="numeric"
              value={value.senderPhone}
              onChange={(e) => onChange({ senderPhone: e.target.value.replace(/[^0-9]/g, '') })}
              onBlur={() => markTouched('senderPhone')}
              placeholder="Telepon *"
              className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                getPhoneError(value.senderPhone, 'senderPhone') ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-amber-200 focus:border-amber-300'
              }`}
              data-testid="input-sender-phone"
            />
            {getPhoneError(value.senderPhone, 'senderPhone') && <p className="text-[10px] text-red-500 mt-0.5">{getPhoneError(value.senderPhone, 'senderPhone')}</p>}
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-3 bg-blue-50/50 border-blue-200">
        <div className="flex items-center gap-1.5 mb-2">
          <User className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold text-gray-700">Penerima</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-[2]">
            <input
              value={value.recipientName}
              onChange={(e) => onChange({ recipientName: e.target.value })}
              onBlur={() => markTouched('recipientName')}
              placeholder="Nama penerima *"
              className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                getError(value.recipientName, 'recipientName') ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
              }`}
              data-testid="input-recipient-name"
            />
            {getError(value.recipientName, 'recipientName') && <p className="text-[10px] text-red-500 mt-0.5">{getError(value.recipientName, 'recipientName')}</p>}
          </div>
          <div className="flex-1">
            <input
              type="tel"
              inputMode="numeric"
              value={value.recipientPhone}
              onChange={(e) => onChange({ recipientPhone: e.target.value.replace(/[^0-9]/g, '') })}
              onBlur={() => markTouched('recipientPhone')}
              placeholder="Telepon *"
              className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                getPhoneError(value.recipientPhone, 'recipientPhone') ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
              }`}
              data-testid="input-recipient-phone"
            />
            {getPhoneError(value.recipientPhone, 'recipientPhone') && <p className="text-[10px] text-red-500 mt-0.5">{getPhoneError(value.recipientPhone, 'recipientPhone')}</p>}
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-3 bg-gray-50 border-gray-200">
        <div className="flex items-center gap-1.5 mb-2">
          <Package className="w-3.5 h-3.5 text-gray-600" />
          <span className="text-xs font-semibold text-gray-700">Detail Barang</span>
        </div>
        <div className="space-y-2">
          {activeCargoTypes.length > 0 && (
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
                Jenis Kargo{cargoTypeRequired ? ' *' : ''}
              </label>
              <SearchableSelect
                value={value.cargoTypeId}
                options={activeCargoTypes.map((ct) => ({ value: ct.id, label: ct.name, badge: ct.code }))}
                placeholder="Pilih jenis..."
                searchPlaceholder="Cari jenis kargo..."
                onChange={(cargoTypeId) => onChange({ cargoTypeId })}
                data-testid="select-cargo-type"
              />
            </div>
          )}
          <div>
            <input
              value={value.itemDescription}
              onChange={(e) => onChange({ itemDescription: e.target.value })}
              onBlur={() => markTouched('itemDescription')}
              placeholder="Deskripsi barang *"
              className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                getError(value.itemDescription, 'itemDescription') ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-amber-200 focus:border-amber-300'
              }`}
              data-testid="input-item-description"
            />
            {getError(value.itemDescription, 'itemDescription') && <p className="text-[10px] text-red-500 mt-0.5">{getError(value.itemDescription, 'itemDescription')}</p>}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="relative">
                <Hash className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  min="1"
                  value={value.quantity}
                  onChange={(e) => onChange({ quantity: e.target.value })}
                  placeholder="Jumlah"
                  className="w-full h-8 pl-7 pr-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                  data-testid="input-quantity"
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="relative">
                <Weight className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  step="0.1"
                  value={value.weightKg}
                  onChange={(e) => onChange({ weightKg: e.target.value })}
                  placeholder="Berat (kg)"
                  className="w-full h-8 pl-7 pr-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                  data-testid="input-weight"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="relative">
                <Ruler className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  step="0.1"
                  value={value.lengthCm}
                  onChange={(e) => onChange({ lengthCm: e.target.value })}
                  placeholder="P (cm)"
                  className="w-full h-8 pl-7 pr-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                  data-testid="input-length"
                />
              </div>
            </div>
            <div className="flex-1">
              <input
                type="number"
                step="0.1"
                value={value.widthCm}
                onChange={(e) => onChange({ widthCm: e.target.value })}
                placeholder="L (cm)"
                className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                data-testid="input-width"
              />
            </div>
            <div className="flex-1">
              <input
                type="number"
                step="0.1"
                value={value.heightCm}
                onChange={(e) => onChange({ heightCm: e.target.value })}
                placeholder="T (cm)"
                className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                data-testid="input-height"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="relative">
                <ShieldCheck className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  value={value.declaredValue}
                  onChange={(e) => onChange({ declaredValue: e.target.value })}
                  placeholder="Nilai barang (Rp, opsional)"
                  className="w-full h-8 pl-7 pr-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                  data-testid="input-declared-value"
                />
              </div>
            </div>
          </div>
          <div>
            <textarea
              value={value.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Catatan (opsional)"
              rows={2}
              className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300 resize-none"
              data-testid="input-notes"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
