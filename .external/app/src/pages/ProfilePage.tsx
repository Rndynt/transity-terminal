import { useState, useEffect } from 'react';
import { useAuth, useNav, useSheet } from '@/App';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Mail, Phone, Calendar, LogOut, HelpCircle, Info, Bell, ChevronRight, Lock, Loader2, X, Check, AlertTriangle, Pencil, User } from 'lucide-react';
import ConfirmSheet from '@/components/ConfirmSheet';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export default function ProfilePage() {
  const { user, logout, login } = useAuth();
  const { navigate, goBack, resetTo } = useNav();
  const { setSheetOpen } = useSheet();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => {
    setSheetOpen(showChangePassword || showEditProfile);
    return () => setSheetOpen(false);
  }, [showChangePassword, showEditProfile, setSheetOpen]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  if (!user) {
    return null;
  }

  let joinDate = '';
  try {
    joinDate = format(parseISO(user.createdAt), 'd MMMM yyyy', { locale: idLocale });
  } catch { joinDate = user.createdAt; }

  const initials = user.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');
    if (!currentPassword || !newPassword) { setPwError('Semua field wajib diisi'); return; }
    if (newPassword.length < 6) { setPwError('Password baru minimal 6 karakter'); return; }
    setPwLoading(true);
    try {
      const res = await authApi.changePassword({ currentPassword, newPassword });
      setPwSuccess(res.message || 'Password berhasil diubah');
      setCurrentPassword('');
      setNewPassword('');
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : 'Gagal mengubah password');
    } finally {
      setPwLoading(false);
    }
  };

  const openEditProfile = () => {
    setEditName(user.fullName);
    setEditPhone(user.phone || '');
    setEditError('');
    setShowEditProfile(true);
  };

  const handleEditProfile = async () => {
    setEditError('');
    const updates: { fullName?: string; phone?: string } = {};
    if (editName.trim() && editName.trim() !== user.fullName) updates.fullName = editName.trim();
    if (editPhone.trim() !== (user.phone || '')) updates.phone = editPhone.trim();
    if (Object.keys(updates).length === 0) { setShowEditProfile(false); return; }
    setEditLoading(true);
    try {
      const updated = await authApi.updateProfile(updates);
      const { store } = await import('@/lib/api');
      login(updated, store.getToken()!);
      setShowEditProfile(false);
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : 'Gagal memperbarui profil');
    } finally {
      setEditLoading(false);
    }
  };

  const menuItems = [
    { icon: Lock, label: 'Ubah Password', action: () => { setPwError(''); setPwSuccess(''); setCurrentPassword(''); setNewPassword(''); setShowChangePassword(true); }, color: 'text-violet-500', bg: 'bg-violet-50' },
    { icon: Bell, label: 'Notifikasi', page: 'notifications' as const, color: 'text-amber-500', bg: 'bg-amber-50' },
    { icon: HelpCircle, label: 'Bantuan & FAQ', page: 'help' as const, color: 'text-blue-500', bg: 'bg-blue-50' },
    { icon: Info, label: 'Tentang Aplikasi', page: 'about' as const, color: 'text-teal-600', bg: 'bg-teal-50' },
  ];

  return (
    <div className="anim-fade min-h-screen bg-[#f8fafa] safe-pb-24">
      <div className="hero-mesh relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.07]" />
          <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full bg-white/[0.05]" />
        </div>
        <div className="relative z-10 px-4 pb-20 safe-top-sm">
          <button
            onClick={goBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors mb-4"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-[72px] h-[72px] rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg shrink-0">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full rounded-2xl object-cover" />
              ) : (
                <span className="text-[24px] font-bold text-white font-display">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-extrabold text-[22px] text-white truncate">{user.fullName}</p>
              <p className="text-[13px] text-teal-200/80 mt-0.5 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-12 relative z-10">
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden mb-4">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-bold text-slate-800">Informasi Akun</h3>
              <button
                onClick={openEditProfile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 hover:bg-teal-100 transition-colors active:scale-95"
              >
                <Pencil className="w-3 h-3 text-teal-600" />
                <span className="text-[11px] font-bold text-teal-600">Edit</span>
              </button>
            </div>
            <div className="space-y-3.5">
              <InfoRow icon={Mail} label="Email" value={user.email} />
              <InfoRow icon={Phone} label="No. HP" value={user.phone || 'Belum diisi'} muted={!user.phone} />
              <InfoRow icon={Calendar} label="Bergabung" value={joinDate} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft overflow-hidden mb-4">
          {menuItems.map((item, i) => (
            <button
              key={item.label}
              onClick={() => 'action' in item && item.action ? item.action() : 'page' in item && item.page ? navigate({ name: item.page }) : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors active:bg-slate-100',
                i < menuItems.length - 1 && 'border-b border-slate-50',
              )}
            >
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', item.bg)}>
                <item.icon className={cn('w-[18px] h-[18px]', item.color)} />
              </div>
              <span className="flex-1 text-left text-[14px] font-medium text-slate-700">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <LogOut className="w-[18px] h-[18px] text-red-500" />
            </div>
            <span className="flex-1 text-left text-[14px] font-medium text-red-500">Keluar dari Akun</span>
          </button>
        </div>
      </div>

      <ConfirmSheet
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Keluar dari Akun?"
        description="Kamu harus login kembali untuk memesan tiket."
        icon={<div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-red-500" /></div>}
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        onConfirm={() => { logout(); resetTo({ name: 'home' }); }}
        onCancel={() => setShowLogoutConfirm(false)}
        variant="warning"
      />

      {showChangePassword && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40 anim-fade" onClick={() => setShowChangePassword(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[110] bg-white rounded-t-[1.5rem] anim-slide-up flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-6 pt-2 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                  <Lock className="w-[18px] h-[18px] text-violet-500" />
                </div>
                <h3 className="text-[17px] font-bold text-slate-800">Ubah Password</h3>
              </div>
              <button onClick={() => setShowChangePassword(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-2">
              <div className="space-y-4">
                <div>
                  <Label className="text-[12px] text-slate-500 font-semibold mb-1.5 block">Password Lama</Label>
                  <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Masukkan password lama"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-[14px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600/40 transition-all" />
                </div>
                <div>
                  <Label className="text-[12px] text-slate-500 font-semibold mb-1.5 block">Password Baru</Label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-[14px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600/40 transition-all" />
                </div>
              </div>
              {pwError && <p className="text-[13px] text-red-500 font-medium mt-3">{pwError}</p>}
              {pwSuccess && <p className="text-[13px] text-green-600 font-medium mt-3">{pwSuccess}</p>}
            </div>
            <div className="shrink-0 px-6 pt-3 pb-6 safe-bottom border-t border-slate-100 bg-white">
              <Button
                className="w-full h-[52px] rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[14px] font-bold shadow-lg shadow-emerald-600/15"
                onClick={handleChangePassword}
                disabled={pwLoading || !currentPassword.trim() || !newPassword.trim()}
              >
                {pwLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Simpan Password
              </Button>
            </div>
          </div>
        </>
      )}

      {showEditProfile && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40 anim-fade" onClick={() => setShowEditProfile(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[110] bg-white rounded-t-[1.5rem] anim-slide-up flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-6 pt-2 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                  <User className="w-[18px] h-[18px] text-teal-600" />
                </div>
                <h3 className="text-[17px] font-bold text-slate-800">Edit Profil</h3>
              </div>
              <button onClick={() => setShowEditProfile(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-2">
              <div className="space-y-4">
                <div>
                  <Label className="text-[12px] text-slate-500 font-semibold mb-1.5 block">Nama Lengkap</Label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nama lengkap"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-[14px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600/40 transition-all" />
                </div>
                <div>
                  <Label className="text-[12px] text-slate-500 font-semibold mb-1.5 block">No. HP</Label>
                  <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="08xxxxxxxxxx"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-[14px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600/40 transition-all" />
                </div>
              </div>
              {editError && <p className="text-[13px] text-red-500 font-medium mt-3">{editError}</p>}
            </div>
            <div className="shrink-0 px-6 pt-3 pb-6 safe-bottom border-t border-slate-100 bg-white">
              <Button
                className="w-full h-[52px] rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[14px] font-bold shadow-lg shadow-emerald-600/15"
                onClick={handleEditProfile}
                disabled={editLoading}
              >
                {editLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, muted }: {
  icon: typeof Mail; label: string; value: string; muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
        <p className={cn('text-[14px] font-medium truncate', muted ? 'text-slate-300 italic' : 'text-slate-700')}>{value}</p>
      </div>
    </div>
  );
}
