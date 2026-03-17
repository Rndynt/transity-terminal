import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { authApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      const { user, token } = await authApi.login({ email, password });
      await setAuth(user, token);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Email atau password salah';
      Alert.alert('Login Gagal', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.form}>
        <Text style={styles.title}>Selamat Datang</Text>
        <Text style={styles.subtitle}>Masuk ke akun Transity Anda</Text>

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
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="input-password"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (!email || !password) && { opacity: 0.5 }]}
          onPress={handleLogin}
          disabled={!email || !password || loading}
          testID="button-login"
        >
          <Text style={styles.submitBtnText}>{loading ? 'Masuk...' : 'Masuk'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} testID="link-register">
          <Text style={styles.linkText}>
            Belum punya akun? <Text style={styles.linkBold}>Daftar</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center' },
  form: { paddingHorizontal: 24 },
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
