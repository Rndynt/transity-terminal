import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../src/lib/api';
import { useState } from 'react';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; phone?: string }) => authApi.updateProfile(data),
    onSuccess: (updated) => {
      useAuthStore.getState().setAuth(updated, useAuthStore.getState().token!);
      setEditing(false);
    },
  });

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await logout();
          queryClient.clear();
        },
      },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="person-circle" size={80} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Belum Masuk</Text>
        <Text style={styles.emptySubtitle}>Masuk untuk mengelola profil Anda</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/(auth)/login')}
          testID="button-goto-login"
        >
          <Text style={styles.primaryBtnText}>Masuk</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/(auth)/register')}
          testID="button-goto-register"
        >
          <Text style={styles.secondaryBtnText}>Daftar Akun</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{(user?.name || 'U')[0].toUpperCase()}</Text>
        </View>
        {!editing && (
          <>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </>
        )}
      </View>

      {editing ? (
        <View style={styles.editCard}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Nama</Text>
            <TextInput style={styles.formInput} value={name} onChangeText={setName} testID="input-name" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Telepon</Text>
            <TextInput style={styles.formInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="input-phone" />
          </View>
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)} testID="button-cancel-edit">
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => updateMutation.mutate({ name, phone })}
              disabled={updateMutation.isPending}
              testID="button-save-profile"
            >
              <Text style={styles.saveBtnText}>{updateMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.menuCard}>
          <MenuItem icon="create" label="Edit Profil" onPress={() => { setName(user?.name || ''); setPhone(user?.phone || ''); setEditing(true); }} />
          <MenuItem icon="ticket" label="Riwayat Booking" onPress={() => router.push('/(tabs)/my-trips')} />
          <MenuItem icon="cube" label="Lacak Kiriman" onPress={() => router.push('/(tabs)/cargo')} />
          <View style={styles.menuDivider} />
          <MenuItem icon="log-out" label="Keluar" onPress={handleLogout} danger />
        </View>
      )}
    </ScrollView>
  );
}

function MenuItem({ icon, label, onPress, danger }: { icon: string; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} testID={`menu-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon as any} size={20} color={danger ? '#EF4444' : '#4B5563'} />
        <Text style={[styles.menuItemLabel, danger && { color: '#EF4444' }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 40 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 24 },
  primaryBtn: { backgroundColor: '#2563EB', borderRadius: 12, paddingHorizontal: 48, paddingVertical: 14, marginBottom: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 12, paddingHorizontal: 48, paddingVertical: 14 },
  secondaryBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 16 },
  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  userName: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  userEmail: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  menuCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemLabel: { fontSize: 15, fontWeight: '500', color: '#1F2937' },
  menuDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 20 },
  editCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  formInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#F9FAFB' },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  saveBtn: { flex: 1, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
