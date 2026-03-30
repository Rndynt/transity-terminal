import { useState } from 'react';
import { useAuth, useNav } from '@/App';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, LogOut, UserCircle2, Mail, Lock, Phone, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type Page = Parameters<ReturnType<typeof useNav>['navigate']>[0];

interface Props {
  returnTo?: Page;
}

export default function AuthPage({ returnTo }: Props) {
  const { user, isLoggedIn, login, logout } = useAuth();
  const { navigate } = useNav();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isLoggedIn && user) {
    return (
      <div className="anim-fade px-4 pt-14 pb-28">
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <div className="bg-gradient-to-br from-teal-800 to-teal-900 p-6">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-3">
              <UserCircle2 className="w-8 h-8 text-white" />
            </div>
            <p className="font-bold text-[18px] text-white">{user.name}</p>
            <p className="text-teal-200 text-[13px] mt-0.5">{user.email}</p>
            {user.phone && <p className="text-teal-300 text-[13px]">{user.phone}</p>}
          </div>
          <div className="p-4">
            <Button
              variant="outline"
              className="w-full h-12 rounded-2xl border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 font-bold text-[13px]"
              onClick={() => { logout(); navigate({ name: 'home' }); }}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              Keluar dari Akun
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await authApi.login({ email, password });
        login(res.user, res.token);
      } else {
        if (!name.trim()) { setError('Nama wajib diisi'); setLoading(false); return; }
        const res = await authApi.register({ email, password, name, phone: phone || undefined });
        login(res.user, res.token);
      }
      if (returnTo) navigate(returnTo);
      else navigate({ name: 'home' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="anim-fade px-4 pt-16 pb-28">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-teal-900 mx-auto mb-4 flex items-center justify-center shadow-glow">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>
        </div>
        <h1 className="font-display font-extrabold text-[24px] text-slate-800">Transity</h1>
        <p className="text-[14px] text-slate-400 mt-1">
          {mode === 'login' ? 'Masuk ke akun Anda' : 'Buat akun baru untuk mulai pesan'}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-soft p-5">
        <div className="flex bg-slate-100 rounded-xl p-1 mb-5">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-all',
                mode === m ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
              )}
            >
              {m === 'login' ? 'Masuk' : 'Daftar'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mode === 'register' && (
            <InputField icon={User} label="Nama" value={name} onChange={setName} placeholder="Nama lengkap" testId="input-name" />
          )}
          <InputField icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="nama@email.com" testId="input-email" />
          <InputField icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="Kata sandi" testId="input-password" />
          {mode === 'register' && (
            <InputField icon={Phone} label="No. HP (opsional)" type="tel" value={phone} onChange={setPhone} placeholder="08xxxxxxxxxx" testId="input-phone" />
          )}
        </div>

        {error && (
          <p className="text-[13px] text-red-500 font-medium mt-3 anim-scale" data-testid="text-error">{error}</p>
        )}

        <Button
          className="w-full mt-5 h-[52px] rounded-2xl bg-teal-900 hover:bg-teal-950 text-[15px] font-bold shadow-lg shadow-teal-900/15 transition-all active:scale-[0.98]"
          onClick={submit}
          disabled={loading || !email || !password}
          data-testid="button-submit"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === 'login' ? 'Masuk' : 'Daftar Sekarang'}
        </Button>
      </div>
    </div>
  );
}

function InputField({ icon: Icon, label, type = 'text', value, onChange, placeholder, testId }: {
  icon: typeof Mail; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder: string; testId: string;
}) {
  return (
    <div>
      <Label className="text-[11px] text-slate-400 font-semibold mb-1 block">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-300" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-[14px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600/40 transition-all"
          data-testid={testId}
        />
      </div>
    </div>
  );
}
