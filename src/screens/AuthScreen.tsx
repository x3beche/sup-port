import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { onColor, theme } from '../theme';

type Mode = 'login' | 'register';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  function switchMode() {
    setMode(isRegister ? 'login' : 'register');
    setError(null);
  }

  async function submit() {
    if (busy) return;
    setError(null);

    if (!email.trim() || !password) {
      setError('E-posta ve parola zorunlu');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Geçerli bir e-posta adresi gir');
      return;
    }
    if (isRegister && !name.trim()) {
      setError('İsim zorunlu');
      return;
    }
    if (isRegister && password.length < 8) {
      setError('Parola en az 8 karakter olmalı');
      return;
    }

    setBusy(true);
    try {
      if (isRegister) await register(name, email, password);
      else await login(email, password);
    } catch (err) {
      setError((err as Error)?.message ?? 'Giriş yapılamadı');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Icon name="check" size={26} strokeWidth={2.4} color={onColor(theme.color.accent)} />
          </View>
          <Text style={styles.appName}>sup-port</Text>
          <Text style={styles.tagline}>Kişisel gelişim, tek uygulamada</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isRegister ? 'Hesap oluştur' : 'Giriş yap'}</Text>

          {isRegister ? (
            <Field
              label="İsim"
              value={name}
              onChangeText={setName}
              placeholder="Adın"
              autoCapitalize="words"
              testID="input-name"
            />
          ) : null}

          <Field
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@eposta.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            testID="input-email"
          />

          <Field
            label="Parola"
            value={password}
            onChangeText={setPassword}
            placeholder={isRegister ? 'En az 8 karakter' : '••••••••'}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            testID="input-password"
            onSubmitEditing={submit}
          />

          {error ? (
            <View style={styles.errorBox} testID="auth-error" accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            testID="submit-auth"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              busy && styles.buttonBusy,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={onColor(theme.color.accent)} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isRegister ? 'Kaydol' : 'Giriş yap'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={switchMode}
            testID="toggle-auth-mode"
            accessibilityRole="button"
            accessibilityLabel={isRegister ? 'Giriş yap ekranına geç' : 'Hesap oluştur ekranına geç'}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              {isRegister ? 'Zaten hesabın var mı? ' : 'Hesabın yok mu? '}
              <Text style={styles.switchLink}>{isRegister ? 'Giriş yap' : 'Kaydol'}</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };

function Field({ label, style, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel} nativeID={`label-${props.testID}`}>
        {label}
      </Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        aria-labelledby={`label-${props.testID}`}
        style={[styles.input, style]}
        placeholderTextColor={theme.color.textFaint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.bg },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.space(6),
  },
  brand: {
    alignItems: 'center',
    marginBottom: theme.space(8),
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space(3),
  },
  
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.color.text,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: theme.space(1),
    fontSize: theme.font.label,
    color: theme.color.textMuted,
  },
  card: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    padding: theme.space(5),
  },
  cardTitle: {
    fontSize: theme.font.title,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: theme.space(4),
  },
  field: { marginBottom: theme.space(4) },
  fieldLabel: {
    fontSize: theme.font.caption,
    fontWeight: '600',
    color: theme.color.textMuted,
    marginBottom: theme.space(1.5),
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    fontSize: theme.font.body,
    color: theme.color.text,
    backgroundColor: theme.color.cardRaised,
  },
  errorBox: {
    backgroundColor: theme.color.errorBg,
    borderRadius: theme.radius.sm,
    padding: theme.space(3),
    marginBottom: theme.space(4),
  },
  errorText: {
    color: theme.color.danger,
    fontSize: theme.font.label,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.space(4),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonBusy: { opacity: 0.75 },
  pressed: { opacity: 0.85 },
  primaryButtonText: {
    color: onColor(theme.color.accent),
    fontSize: theme.font.body,
    fontWeight: '700',
  },
  switchRow: {
    marginTop: theme.space(4),
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    fontSize: theme.font.label,
    color: theme.color.textMuted,
  },
  switchLink: {
    color: theme.color.accent,
    fontWeight: '700',
  },
});
