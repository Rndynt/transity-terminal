import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { authApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) return;
    setLoading(true);
    try {
      const { user, token } = await authApi.register({ email, password, name, phone: phone || undefined });
      await setAuth(user, token);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Registrasi Gagal', e.message || 'Gagal mendaftar');
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.length > 0 && email.length > 0 && password.length >= 6;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Buat Akun</Text>
        <Text style={styles.subtitle}>Daftar untuk mulai memesan tiket</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nama Lengkap</Text>
          <TextInput style={styles.input} placeholder="Nama Anda" value={name} onChangeText={setName} testID="input-name" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@contoh.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            testID="input-email"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Telepon (opsional)</Text>
          <TextInput
            style={styles.input}
            placeholder="08xxxxxxxxxx"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            testID="input-phone"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password (min. 6 karakter)</Text>
          <TextInput
            style={styles.input}
            placeholder="Buat password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="input-password"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, !isValid && { opacity: 0.5 }]}
          onPress={handleRegister}
          disabled={!isValid || loading}
          testID="button-register"
        >
          <Text style={styles.submitBtnText}>{loading ? 'Mendaftar...' : 'Daftar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')} testID="link-login">
          <Text style={styles.linkText}>
            Sudah punya akun? <Text style={styles.linkBold}>Masuk</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 32 },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
  },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkText: { textAlign: 'center', fontSize: 14, color: '#6B7280' },
  linkBold: { color: '#2563EB', fontWeight: '700' },
});
