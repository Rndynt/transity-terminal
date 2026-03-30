import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, Upload, Palette, Type, ImageIcon, RotateCcw, Bus } from 'lucide-react';

interface OperatorSettingsData {
  id: string;
  brandName: string;
  tagline: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

const DEFAULTS: Omit<OperatorSettingsData, 'id'> = {
  brandName: 'Transity',
  tagline: 'Multi-Stop Travel System',
  logoUrl: null,
  primaryColor: '#2563EB',
  secondaryColor: '#1E40AF',
  accentColor: '#F59E0B',
};

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<OperatorSettingsData>({
    queryKey: ['/api/settings'],
  });

  const [form, setForm] = useState<Omit<OperatorSettingsData, 'id'> | null>(null);
  const activeForm = form ?? settings ?? DEFAULTS;

  const updateField = (key: keyof typeof DEFAULTS, value: string | null) => {
    setForm(prev => ({ ...(prev ?? settings ?? DEFAULTS), [key]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<OperatorSettingsData>) => {
      const res = await apiRequest('PUT', '/api/settings', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      setForm(null);
      toast({ title: 'Berhasil', description: 'Pengaturan berhasil disimpan' });
    },
    onError: () => {
      toast({ title: 'Gagal', description: 'Gagal menyimpan pengaturan', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(activeForm);
  };

  const handleReset = () => {
    setForm({ ...DEFAULTS });
  };

  const hasChanges = form !== null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 h-full overflow-y-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900" data-testid="text-settings-title">Pengaturan Operator</h1>
        <p className="text-sm text-gray-500 mt-1">Atur identitas brand terminal Anda</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-base">Identitas Brand</CardTitle>
          </div>
          <CardDescription>Nama dan tagline yang muncul di sidebar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brandName">Nama Brand</Label>
            <Input
              id="brandName"
              value={activeForm.brandName}
              onChange={e => updateField('brandName', e.target.value)}
              placeholder="Nama perusahaan Anda"
              data-testid="input-brand-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={activeForm.tagline}
              onChange={e => updateField('tagline', e.target.value)}
              placeholder="Deskripsi singkat"
              data-testid="input-tagline"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-base">Logo</CardTitle>
          </div>
          <CardDescription>Logo akan ditampilkan di sidebar. Gunakan URL gambar (PNG/SVG, rasio 1:1 disarankan)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 shrink-0 overflow-hidden">
              {activeForm.logoUrl ? (
                <img src={activeForm.logoUrl} alt="Logo" className="w-full h-full object-contain" data-testid="img-logo-preview" />
              ) : (
                <Bus className="w-7 h-7 text-gray-300" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="logoUrl">URL Logo</Label>
              <Input
                id="logoUrl"
                value={activeForm.logoUrl || ''}
                onChange={e => updateField('logoUrl', e.target.value || null)}
                placeholder="https://example.com/logo.png"
                data-testid="input-logo-url"
              />
              {activeForm.logoUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-red-500 hover:text-red-700 px-0"
                  onClick={() => updateField('logoUrl', null)}
                  data-testid="button-remove-logo"
                >
                  Hapus logo
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-base">Warna Brand</CardTitle>
          </div>
          <CardDescription>Warna yang digunakan di sidebar dan elemen UI</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorField
              label="Warna Utama"
              value={activeForm.primaryColor}
              onChange={v => updateField('primaryColor', v)}
              testId="input-primary-color"
            />
            <ColorField
              label="Warna Sekunder"
              value={activeForm.secondaryColor}
              onChange={v => updateField('secondaryColor', v)}
              testId="input-secondary-color"
            />
            <ColorField
              label="Warna Aksen"
              value={activeForm.accentColor}
              onChange={v => updateField('accentColor', v)}
              testId="input-accent-color"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Preview Sidebar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-56 bg-white border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                style={{ backgroundColor: activeForm.primaryColor }}
              >
                {activeForm.logoUrl ? (
                  <img src={activeForm.logoUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Bus className="w-4 h-4 text-white" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 leading-tight">{activeForm.brandName || 'Transity'}</p>
                <p className="text-[10px] text-gray-400">{activeForm.tagline || 'Multi-Stop Travel System'}</p>
              </div>
            </div>
            <div className="mt-4 space-y-1">
              {['Dashboard', 'Reservasi', 'Jadwal'].map(item => (
                <div key={item} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-500">
                  <div className="w-3 h-3 rounded bg-gray-200" />
                  {item}
                </div>
              ))}
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-white font-medium"
                style={{ backgroundColor: activeForm.primaryColor + '18', color: activeForm.primaryColor }}
              >
                <div className="w-3 h-3 rounded" style={{ backgroundColor: activeForm.primaryColor }} />
                Pengaturan
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pb-8">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="gap-2"
          data-testid="button-save-settings"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          className="gap-2"
          data-testid="button-reset-settings"
        >
          <RotateCcw className="w-4 h-4" />
          Reset ke Default
        </Button>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange, testId }: {
  label: string; value: string; onChange: (v: string) => void; testId: string;
}) {
  const colorRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <button
          className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer shrink-0 shadow-sm"
          style={{ backgroundColor: value }}
          onClick={() => colorRef.current?.click()}
          data-testid={testId}
        />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="text-xs font-mono h-9"
          placeholder="#000000"
        />
        <input
          ref={colorRef}
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="sr-only"
        />
      </div>
    </div>
  );
}
