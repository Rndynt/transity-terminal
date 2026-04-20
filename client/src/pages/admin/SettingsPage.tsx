import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, Upload, Palette, Type, ImageIcon, RotateCcw, Bus, Plug, CheckCircle2, XCircle, AlertCircle, Send } from 'lucide-react';

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

      <ConsoleWebhookCard />

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

interface ConsoleHealthData {
  configured: boolean;
  missing: string[];
  url: string | null;
  operatorSlug: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastSuccessEvent: string | null;
  lastErrorAt: string | null;
  lastError:
    | { event: string; reason: 'transport'; error: string }
    | { event: string; reason: 'http'; status: number; body: string }
    | null;
  consecutiveFailures: number;
  retryQueueSize: number;
}

interface TestResult {
  result:
    | { ok: true }
    | { ok: false; reason: 'skip' }
    | { ok: false; reason: 'transport'; error: string }
    | { ok: false; reason: 'http'; status: number; body: string };
  health: ConsoleHealthData;
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'belum pernah';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return new Date(iso).toLocaleString();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.round(hr / 24);
  return `${day} hari lalu`;
}

function ConsoleWebhookCard() {
  const { toast } = useToast();
  const { data: health, isLoading, isError, error, refetch } = useQuery<ConsoleHealthData>({
    queryKey: ['/api/settings/console-webhook'],
    refetchInterval: 15_000,
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/settings/console-webhook/test');
      return res.json() as Promise<TestResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/console-webhook'] });
      if (data.result.ok) {
        toast({ title: 'Berhasil', description: 'Console menerima event uji coba.' });
      } else if (data.result.reason === 'http') {
        toast({
          title: 'Gagal',
          description: `Console menolak (HTTP ${data.result.status}): ${data.result.body || '-'}`,
          variant: 'destructive',
        });
      } else if (data.result.reason === 'transport') {
        toast({
          title: 'Tidak terhubung',
          description: data.result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Tidak terkirim',
          description: 'Console webhook belum dikonfigurasi.',
          variant: 'destructive',
        });
      }
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/console-webhook'] });
      // apiRequest throws Error("<status>: <body>") on non-2xx responses, so
      // pull the JSON body off the message to surface the structured reason.
      let msg = 'Gagal mengirim event uji coba.';
      const match = err.message.match(/^\d+:\s*(.*)$/s);
      const bodyText = match ? match[1] : err.message;
      let parsed: { reason?: string; missing?: unknown } | null = null;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        parsed = null;
      }
      if (parsed?.reason === 'not_configured' && Array.isArray(parsed.missing)) {
        msg = `Konfigurasi belum lengkap: ${parsed.missing.join(', ')}`;
      } else if (bodyText) {
        msg = bodyText;
      }
      toast({ title: 'Gagal', description: msg, variant: 'destructive' });
    },
  });

  let statusBadge: { icon: typeof CheckCircle2; label: string; className: string };
  if (!health?.configured) {
    statusBadge = { icon: AlertCircle, label: 'Belum dikonfigurasi', className: 'text-amber-700 bg-amber-50 border-amber-200' };
  } else if (health.consecutiveFailures > 0) {
    statusBadge = { icon: XCircle, label: `Gagal (${health.consecutiveFailures}x berturut-turut)`, className: 'text-red-700 bg-red-50 border-red-200' };
  } else if (health.lastSuccessAt) {
    statusBadge = { icon: CheckCircle2, label: 'Terhubung', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  } else {
    statusBadge = { icon: AlertCircle, label: 'Belum ada aktivitas', className: 'text-gray-700 bg-gray-50 border-gray-200' };
  }
  const StatusIcon = statusBadge.icon;

  return (
    <Card data-testid="card-console-webhook">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Plug className="w-4 h-4 text-blue-600" />
          <CardTitle className="text-base">Koneksi Console</CardTitle>
        </div>
        <CardDescription>
          Status sinkronisasi jadwal Terminal ke Transity Console.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat status...
          </div>
        ) : isError || !health ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 space-y-2" data-testid="text-console-health-error">
            <div>Gagal memuat status koneksi Console.{error?.message ? ` ${error.message}` : ''}</div>
            <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-retry-console-health">
              Coba lagi
            </Button>
          </div>
        ) : (
          <>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${statusBadge.className}`} data-testid="status-console-webhook">
              <StatusIcon className="w-3.5 h-3.5" />
              {statusBadge.label}
            </div>

            {!health.configured && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" data-testid="text-console-missing-config">
                Variabel berikut belum di-set: <span className="font-mono">{health.missing.join(', ')}</span>. Hubungi admin untuk mengisi konfigurasi webhook.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <InfoRow label="Console URL" value={health.url || '—'} testId="text-console-url" mono />
              <InfoRow label="Operator slug" value={health.operatorSlug || '—'} testId="text-console-slug" mono />
              <InfoRow
                label="Push terakhir berhasil"
                value={
                  health.lastSuccessAt
                    ? `${formatRelative(health.lastSuccessAt)}${health.lastSuccessEvent ? ` · ${health.lastSuccessEvent}` : ''}`
                    : 'belum pernah'
                }
                testId="text-console-last-success"
              />
              <InfoRow
                label="Error terakhir"
                value={
                  health.lastErrorAt
                    ? formatRelative(health.lastErrorAt)
                    : 'tidak ada'
                }
                testId="text-console-last-error-time"
              />
              <InfoRow label="Antrian retry" value={String(health.retryQueueSize)} testId="text-console-queue-size" />
              <InfoRow label="Kegagalan beruntun" value={String(health.consecutiveFailures)} testId="text-console-consecutive-failures" />
            </div>

            {health.lastError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 space-y-1" data-testid="text-console-last-error-detail">
                <div className="font-medium">
                  Detail error ({health.lastError.event})
                </div>
                {health.lastError.reason === 'http' ? (
                  <div className="font-mono break-all">
                    HTTP {health.lastError.status}: {health.lastError.body || '(tanpa body)'}
                  </div>
                ) : (
                  <div className="font-mono break-all">Transport: {health.lastError.error}</div>
                )}
              </div>
            )}

            <Button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !health.configured}
              variant="outline"
              size="sm"
              className="gap-2"
              data-testid="button-test-console-webhook"
            >
              {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Kirim event uji coba
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, testId, mono }: { label: string; value: string; testId: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-gray-800 break-all ${mono ? 'font-mono' : ''}`} data-testid={testId}>{value}</div>
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
