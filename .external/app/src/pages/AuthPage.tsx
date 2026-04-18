import { useState } from 'react';
import { useAuth, useNav } from '@/App';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type Page = Parameters<ReturnType<typeof useNav>['navigate']>[0];

interface Props {
  returnTo?: Page;
}

export default function AuthPage({ returnTo }: Props) {
  const { isLoggedIn, login } = useAuth();
  const { navigate, goBack } = useNav();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (isLoggedIn) {
    return null;
  }

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const loginData = loginMethod === 'email'
          ? { email, password }
          : { phone, password };
        const res = await authApi.login(loginData);
        login(res.user, res.token);
      } else {
        if (!fullName.trim()) { setError('Nama wajib diisi'); setLoading(false); return; }
        if (!phone.trim()) { setError('No. HP wajib diisi'); setLoading(false); return; }
        if (!email.trim()) { setError('Email wajib diisi'); setLoading(false); return; }
        const res = await authApi.register({ fullName: fullName.trim(), email, phone, password });
        login(res.user, res.token);
      }
      if (returnTo) navigate(returnTo);
      else navigate({ name: 'profile' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = mode === 'login'
    ? (loginMethod === 'email' ? !!email : !!phone) && !!password
    : !!email && !!password && !!fullName && !!phone;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafa]">
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-600 pb-10 rounded-b-[32px] safe-top-sm">
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute top-6 left-8 w-24 h-24 border-2 border-white rounded-full" />
          <div className="absolute -top-4 right-12 w-40 h-40 border-2 border-white rounded-full" />
          <div className="absolute bottom-4 left-1/2 w-16 h-16 border-2 border-white rounded-full" />
        </div>

        <div className="relative z-10 px-5">
          <button
            onClick={() => goBack()}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors mb-5"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <div className="px-1 anim-fade">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/>
                  <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
                  <circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>
                </svg>
              </div>
              <span className="text-white/60 text-[13px] font-semibold tracking-wide">TRANSITY</span>
            </div>
            <h1 className="font-display text-[28px] font-extrabold text-white leading-[1.15] tracking-tight">
              {mode === 'login' ? (
                <>Selamat Datang<br />Kembali!</>
              ) : (
                <>Mulai Perjalanan<br />Bersama Kami</>
              )}
            </h1>
            <p className="text-[14px] text-white/60 mt-2.5 leading-relaxed">
              {mode === 'login'
                ? 'Masuk dan pesan tiket perjalananmu'
                : 'Buat akun gratis, cuma 1 menit'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 -mt-4 pb-8">
        <div className="bg-white rounded-3xl shadow-lg shadow-black/[0.04] border border-slate-100/80 p-5 anim-slide-up">
          <div className="space-y-3.5">
            {mode === 'register' && (
              <FloatingInput
                label="Nama Lengkap"
                type="text"
                value={fullName}
                onChange={setFullName}
                testId="input-name"
                autoFocus
              />
            )}

            {mode === 'login' && (
              <div className="flex bg-slate-50 rounded-[14px] p-1 anim-fade">
                {(['email', 'phone'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setLoginMethod(m)}
                    className={cn(
                      'flex-1 py-2.5 rounded-[11px] text-[13px] font-semibold transition-all duration-200',
                      loginMethod === m
                        ? 'bg-white text-teal-800 shadow-sm ring-1 ring-black/[0.03]'
                        : 'text-slate-400',
                    )}
                  >
                    {m === 'email' ? 'Email' : 'No. HP'}
                  </button>
                ))}
              </div>
            )}

            {mode === 'login' && loginMethod === 'email' && (
              <FloatingInput label="Email" type="email" value={email} onChange={setEmail} testId="input-email" autoFocus />
            )}
            {mode === 'login' && loginMethod === 'phone' && (
              <FloatingInput label="No. HP" type="tel" value={phone} onChange={setPhone} testId="input-phone" autoFocus />
            )}

            {mode === 'register' && (
              <>
                <FloatingInput label="Email" type="email" value={email} onChange={setEmail} testId="input-email" />
                <FloatingInput label="No. HP" type="tel" value={phone} onChange={setPhone} testId="input-phone" />
              </>
            )}

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                aria-label="Kata sandi"
                className="peer w-full h-[56px] px-4 pt-5 pb-2 rounded-2xl border border-slate-200 bg-white text-[15px] font-medium text-slate-800 placeholder-transparent focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
                data-testid="input-password"
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
              />
              <label className="absolute left-4 top-2 text-[11px] font-semibold text-slate-400 transition-all peer-placeholder-shown:top-[17px] peer-placeholder-shown:text-[14px] peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-teal-600 pointer-events-none">
                Kata Sandi
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword
                  ? <EyeOff className="w-[18px] h-[18px] text-slate-400" />
                  : <Eye className="w-[18px] h-[18px] text-slate-400" />
                }
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 px-4 py-3 bg-red-50 rounded-2xl anim-scale">
              <p className="text-[13px] text-red-500 font-medium" data-testid="text-error">{error}</p>
            </div>
          )}

          <Button
            className={cn(
              'w-full mt-5 h-[54px] rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98]',
              'bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700',
              'shadow-lg shadow-teal-700/25',
              'disabled:opacity-30 disabled:shadow-none disabled:from-slate-400 disabled:to-slate-400',
            )}
            onClick={submit}
            disabled={loading || !canSubmit}
            data-testid="button-submit"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              mode === 'login' ? 'Masuk' : 'Daftar Sekarang'
            )}
          </Button>
        </div>

        <div className="mt-6 flex items-center gap-3 px-2">
          <div className="flex-1 h-px bg-slate-200/60" />
          <span className="text-[12px] text-slate-400 font-medium">atau</span>
          <div className="flex-1 h-px bg-slate-200/60" />
        </div>

        <button
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          className="w-full mt-5 h-[52px] rounded-2xl border-2 border-teal-600/20 text-[14px] font-bold text-teal-700 hover:bg-teal-50/50 hover:border-teal-600/30 transition-all active:scale-[0.98]"
        >
          {mode === 'login' ? 'Buat Akun Baru' : 'Sudah Punya Akun? Masuk'}
        </button>

        <p className="text-center text-[11px] text-slate-400 mt-6 leading-relaxed">
          Dengan melanjutkan, kamu menyetujui<br />
          <span className="text-teal-600 font-medium">Syarat & Ketentuan</span> Transity
        </p>
      </div>
    </div>
  );
}

function FloatingInput({ label, type = 'text', value, onChange, testId, autoFocus }: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; testId: string; autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        aria-label={label}
        autoFocus={autoFocus}
        className="peer w-full h-[56px] px-4 pt-5 pb-2 rounded-2xl border border-slate-200 bg-white text-[15px] font-medium text-slate-800 placeholder-transparent focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
        data-testid={testId}
      />
      <label className="absolute left-4 top-2 text-[11px] font-semibold text-slate-400 transition-all peer-placeholder-shown:top-[17px] peer-placeholder-shown:text-[14px] peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-teal-600 pointer-events-none">
        {label}
      </label>
    </div>
  );
}
