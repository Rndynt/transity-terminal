import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { MapPin } from 'lucide-react';

interface TripPattern {
  id: string;
  code: string;
  name: string;
  note?: string;
}

interface Layout {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  code: string;
  plate: string;
}

interface TripBaseFormData {
  patternId: string;
  code: string;
  name: string;
  active: boolean;
  timezone: string;
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
  validFrom: string;
  validTo: string;
  defaultLayoutId: string;
  defaultVehicleId: string;
  capacity: string;
  channelFlags: any;
  defaultStopTimes: Array<{
    stopSequence: number;
    arriveAt: string;
    departAt: string;
  }>;
}

interface DefaultStopTime {
  stopSequence: number;
  stopName?: string;
  stopCode?: string;
  arriveAt: string;
  departAt: string;
}

interface TripBase {
  id: string;
  name: string;
}

interface TripBaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBase: TripBase | null;
  formData: TripBaseFormData;
  setFormData: React.Dispatch<React.SetStateAction<TripBaseFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  patterns: TripPattern[];
  layouts: Layout[];
  vehicles: Vehicle[];
  stopTimes: DefaultStopTime[];
  updateStopTime: (sequence: number, field: 'arriveAt' | 'departAt', value: string) => void;
  onPatternChange: (patternId: string) => void;
}

export default function TripBaseFormDialog({
  open,
  onOpenChange,
  editingBase,
  formData,
  setFormData,
  onSubmit,
  isPending,
  patterns,
  layouts,
  vehicles,
  stopTimes,
  updateStopTime,
  onPatternChange,
}: TripBaseFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <DialogTitle>
            {editingBase ? 'Edit Trip Base' : 'Tambah Trip Base'}
          </DialogTitle>
          <DialogDescription>
            {editingBase
              ? 'Ubah informasi template penjadwalan virtual.'
              : 'Buat template penjadwalan virtual baru yang menghasilkan perjalanan nyata sesuai permintaan.'}
          </DialogDescription>
        </DialogHeader>

        <form id="trip-base-form" onSubmit={onSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informasi Dasar</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pattern">Trip Pattern <span className="text-destructive">*</span></Label>
                <SearchableSelect
                  value={formData.patternId}
                  options={patterns.map((p: TripPattern) => ({ value: p.id, label: p.name, badge: p.code }))}
                  placeholder="Pilih pola perjalanan..."
                  searchPlaceholder="Cari pola..."
                  onChange={(value) => {
                    setFormData(prev => ({ ...prev, patternId: value }));
                    onPatternChange(value);
                  }}
                  data-testid="select-pattern"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nama <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Contoh: Pagi Express Slot 1"
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="code">Kode <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="Kode unik"
                    data-testid="input-code"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Status Aktif</p>
                  <p className="text-xs text-muted-foreground">Trip base ini aktif menghasilkan perjalanan</p>
                </div>
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                  data-testid="switch-active"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hari Operasi</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'mon', label: 'Sen' },
                { key: 'tue', label: 'Sel' },
                { key: 'wed', label: 'Rab' },
                { key: 'thu', label: 'Kam' },
                { key: 'fri', label: 'Jum' },
                { key: 'sat', label: 'Sab' },
                { key: 'sun', label: 'Min' },
              ] as { key: keyof TripBaseFormData; label: string }[]).map(day => {
                const isOn = formData[day.key] as boolean;
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, [day.key]: !isOn }))}
                    className={`w-10 h-10 rounded-md text-sm font-medium border transition-colors ${isOn ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-muted hover:text-foreground'}`}
                    data-testid={`toggle-${day.key}`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Periode Berlaku</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="validFrom">Berlaku Dari</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                  data-testid="input-valid-from"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="validTo">Berlaku Sampai</Label>
                <Input
                  id="validTo"
                  type="date"
                  value={formData.validTo}
                  onChange={(e) => setFormData(prev => ({ ...prev, validTo: e.target.value }))}
                  data-testid="input-valid-to"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Kosongkan keduanya jika berlaku tanpa batas waktu</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nilai Default</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Layout</Label>
                <SearchableSelect
                  value={formData.defaultLayoutId}
                  options={[
                    { value: 'none', label: '— Tidak ada —' },
                    ...layouts.map((l: Layout) => ({ value: l.id, label: l.name }))
                  ]}
                  placeholder="Pilih layout..."
                  searchPlaceholder="Cari layout..."
                  onChange={(value) => setFormData(prev => ({ ...prev, defaultLayoutId: value }))}
                  clearValue="none"
                  data-testid="select-layout"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kendaraan</Label>
                <SearchableSelect
                  value={formData.defaultVehicleId}
                  options={[
                    { value: 'none', label: '— Tidak ada —' },
                    ...vehicles.map((v: Vehicle) => ({ value: v.id, label: `${v.code} — ${v.plate}` }))
                  ]}
                  placeholder="Pilih kendaraan..."
                  searchPlaceholder="Cari kendaraan..."
                  onChange={(value) => setFormData(prev => ({ ...prev, defaultVehicleId: value }))}
                  clearValue="none"
                  data-testid="select-vehicle"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="capacity">Override Kapasitas</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                  placeholder="Maks penumpang"
                  data-testid="input-capacity"
                />
              </div>
            </div>
          </div>

          {stopTimes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Waktu Henti Default</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="rounded-lg bg-muted/40 border border-dashed px-3 py-2 mb-3 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Asal</span> → hanya isi <strong>Berangkat</strong> (waktu bus mulai jalan dari titik awal).
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Transit</span> → isi <strong>Tiba</strong> dan <strong>Berangkat</strong> (bus singgah lalu lanjut).
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Tujuan</span> → hanya isi <strong>Tiba</strong> (waktu bus tiba di titik akhir).
                </p>
              </div>
              <div className="rounded-lg border overflow-hidden">
                {stopTimes.map((stopTime, index) => {
                  const isFirst = index === 0;
                  const isLast = index === stopTimes.length - 1;
                  const isTransit = !isFirst && !isLast;
                  const role = isFirst ? 'Asal' : isLast ? 'Tujuan' : 'Transit';
                  const roleColor = isFirst
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : isLast
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800'
                    : 'bg-muted text-muted-foreground border-border';
                  return (
                    <div
                      key={stopTime.stopSequence}
                      className={`flex flex-wrap items-center gap-3 px-4 py-3 ${index < stopTimes.length - 1 ? 'border-b' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-[140px] flex-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${roleColor}`}>
                          {role}
                        </span>
                        <span className="text-sm font-medium text-foreground truncate">
                          {stopTime.stopName && stopTime.stopName !== `Stop ${stopTime.stopSequence}`
                            ? stopTime.stopName
                            : `Halte #${stopTime.stopSequence}`}
                        </span>
                      </div>

                      <div className="flex gap-3 flex-wrap">
                        <div className="space-y-1">
                          <Label className={`text-xs ${isFirst ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
                            Tiba{isLast ? <span className="text-destructive ml-0.5">*</span> : ''}
                            {isTransit && <span className="text-destructive ml-0.5">*</span>}
                          </Label>
                          {isFirst ? (
                            <div className="h-8 w-28 flex items-center justify-center rounded-md border border-dashed border-muted-foreground/20 bg-muted/30">
                              <span className="text-xs text-muted-foreground/40">—</span>
                            </div>
                          ) : (
                            <Input
                              id={`arrive-${stopTime.stopSequence}`}
                              type="time"
                              step="60"
                              value={stopTime.arriveAt}
                              onChange={(e) => updateStopTime(stopTime.stopSequence, 'arriveAt', e.target.value)}
                              className="h-8 w-28 text-sm"
                              data-testid={`input-arrive-${stopTime.stopSequence}`}
                            />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className={`text-xs ${isLast ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
                            Berangkat{isFirst ? <span className="text-destructive ml-0.5">*</span> : ''}
                            {isTransit && <span className="text-destructive ml-0.5">*</span>}
                          </Label>
                          {isLast ? (
                            <div className="h-8 w-28 flex items-center justify-center rounded-md border border-dashed border-muted-foreground/20 bg-muted/30">
                              <span className="text-xs text-muted-foreground/40">—</span>
                            </div>
                          ) : (
                            <Input
                              id={`depart-${stopTime.stopSequence}`}
                              type="time"
                              step="60"
                              value={stopTime.departAt}
                              onChange={(e) => updateStopTime(stopTime.stopSequence, 'departAt', e.target.value)}
                              className="h-8 w-28 text-sm"
                              data-testid={`input-depart-${stopTime.stopSequence}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stopTimes.length === 0 && formData.patternId && (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              <MapPin className="h-5 w-5 mx-auto mb-2 opacity-40" />
              Memuat data henti dari pola perjalanan...
            </div>
          )}

          {stopTimes.length === 0 && !formData.patternId && (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              <MapPin className="h-5 w-5 mx-auto mb-2 opacity-40" />
              Pilih trip pattern terlebih dahulu untuk mengatur waktu henti
            </div>
          )}

        </form>

        <DialogFooter className="px-5 py-4 border-t shrink-0 bg-background">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Batal
          </Button>
          <Button
            type="submit"
            form="trip-base-form"
            disabled={isPending}
            data-testid="button-save"
          >
            {isPending ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
