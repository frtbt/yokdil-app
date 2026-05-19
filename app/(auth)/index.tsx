import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, Animated, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '../../store/useAuthStore';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
} from '../../constants/Google';

const { width, height } = Dimensions.get('window');

// ─── Reusable shake hook ──────────────────────────────────────────────────────
function useShake() {
  const x = useRef(new Animated.Value(0)).current;
  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(x, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(x, { toValue:  12, duration: 55, useNativeDriver: true }),
      Animated.timing(x, { toValue:  -8, duration: 55, useNativeDriver: true }),
      Animated.timing(x, { toValue:   8, duration: 55, useNativeDriver: true }),
      Animated.timing(x, { toValue:  -4, duration: 55, useNativeDriver: true }),
      Animated.timing(x, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [x]);
  return { shakeX: x, shake };
}

// ─── Animated Input ───────────────────────────────────────────────────────────
interface InputProps {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  isPassword?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'words';
  hasError?: boolean;
  returnKeyType?: 'next' | 'done' | 'go';
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
}

function AnimatedInput({
  icon, placeholder, value, onChangeText,
  isPassword, keyboardType, autoCapitalize,
  hasError, returnKeyType, onSubmitEditing, inputRef,
}: InputProps) {
  const focusAnim = useRef(new Animated.Value(0)).current;
  const [showPwd, setShowPwd] = useState(false);

  const handleFocus = () =>
    Animated.timing(focusAnim, { toValue: 1, duration: 220, useNativeDriver: false }).start();
  const handleBlur  = () =>
    Animated.timing(focusAnim, { toValue: 0, duration: 220, useNativeDriver: false }).start();

  const borderColor = focusAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [hasError ? 'rgba(245,87,108,0.7)' : 'rgba(255,255,255,0.12)', '#6C63FF'],
  });
  const shadowOpacity = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  return (
    <Animated.View style={[
      styles.inputWrap,
      { borderColor, shadowOpacity, shadowColor: '#6C63FF', shadowRadius: 10, elevation: 0 },
    ]}>
      <Feather name={icon as any} size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.28)"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={isPassword && !showPwd}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        returnKeyType={returnKeyType ?? 'done'}
        onSubmitEditing={onSubmitEditing}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {isPassword && (
        <TouchableOpacity
          onPress={() => { setShowPwd(!showPwd); Haptics.selectionAsync(); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name={showPwd ? 'eye' : 'eye-off'} size={18} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function OrDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>veya</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

// ─── Google Button ────────────────────────────────────────────────────────────
function GoogleButton({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.googleBtn, loading && { opacity: 0.7 }]}
        activeOpacity={1}
        disabled={loading}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      >
        {loading ? (
          <ActivityIndicator color="#4285F4" size="small" />
        ) : (
          <View style={styles.googleIconCircle}>
            <Text style={styles.googleG}>G</Text>
          </View>
        )}
        <Text style={styles.googleText}>
          {loading ? 'Bağlanıyor…' : 'Google ile Devam Et'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Primary Button ───────────────────────────────────────────────────────────
function PrimaryButton({ label, loading, onPress }: { label: string; loading: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[styles.primaryBtnWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        onPress={() => { if (!loading) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); } }}
      >
        <LinearGradient
          colors={['#6C63FF', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryBtn}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.primaryBtnText}>{label}</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const { login, register, loginWithGoogle, isLoading, error, clearError } = useAuthStore();

  // ── Google Sign-In (native SDK — expo-auth-session browser akışı Android'de çalışmaz) ──
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: ['email', 'profile'],
      // iOS için Google Cloud Console'dan alınan iOS OAuth client ID
      ...(Platform.OS === 'ios' && GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
    });
  }, []);

  const handleGooglePress = useCallback(async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      Alert.alert('Yapılandırılmadı', 'Google girişi henüz yapılandırılmamış.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setGoogleLoading(true);
      // hasPlayServices yalnızca Android'de gereklidir
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error('ID token alınamadı');
      const ok = await loginWithGoogle(idToken);
      if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Google Hatası', error.message ?? 'Giriş başarısız.');
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [loginWithGoogle]);

  // Slide animation: 0 = login, 1 = register
  const slide = useRef(new Animated.Value(0)).current;
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Blob float animations
  const blob1Y = useRef(new Animated.Value(0)).current;
  const blob2Y = useRef(new Animated.Value(0)).current;
  const blob3Y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const float = (anim: Animated.Value, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: -18, duration: dur, useNativeDriver: true }),
          Animated.timing(anim, { toValue:   0, duration: dur, useNativeDriver: true }),
        ])
      ).start();
    float(blob1Y, 3200);
    float(blob2Y, 4100);
    float(blob3Y, 2800);
  }, []);

  // Login fields
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const loginShake = useShake();

  // Register fields
  const [regName,     setRegName]     = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm,  setRegConfirm]  = useState('');
  const regShake = useShake();

  // Field refs for keyboard "Next"
  const loginPwdRef   = useRef<TextInput>(null);
  const regEmailRef   = useRef<TextInput>(null);
  const regPwdRef     = useRef<TextInput>(null);
  const regConfirmRef = useRef<TextInput>(null);

  // Validation errors (field-level)
  const [loginErrors,  setLoginErrors]  = useState({ email: false, password: false });
  const [regErrors,    setRegErrors]    = useState({ name: false, email: false, password: false, confirm: false });

  const switchMode = (next: 'login' | 'register') => {
    Haptics.selectionAsync();
    setMode(next);
    clearError();
    Animated.spring(slide, {
      toValue: next === 'login' ? 0 : 1,
      damping: 18, stiffness: 130, useNativeDriver: true,
    }).start();
  };

  // ── Inline validation ────────────────────────────────────────────────────────
  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleLogin = async () => {
    const emailErr = !validateEmail(loginEmail);
    const pwdErr   = loginPassword.length < 6;
    setLoginErrors({ email: emailErr, password: pwdErr });
    if (emailErr || pwdErr) { loginShake.shake(); return; }

    const ok = await login(loginEmail, loginPassword);
    if (!ok) {
      loginShake.shake();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleRegister = async () => {
    const nameErr  = regName.trim().length < 2;
    const emailErr = !validateEmail(regEmail);
    const pwdErr   = regPassword.length < 6;
    const confErr  = regPassword !== regConfirm;
    setRegErrors({ name: nameErr, email: emailErr, password: pwdErr, confirm: confErr });
    if (nameErr || emailErr || pwdErr || confErr) { regShake.shake(); return; }

    const ok = await register(regName, regEmail, regPassword);
    if (!ok) {
      regShake.shake();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Slide transforms
  const loginX    = slide.interpolate({ inputRange: [0, 1], outputRange: [0,     -width] });
  const registerX = slide.interpolate({ inputRange: [0, 1], outputRange: [width,  0]     });

  return (
    <View style={styles.root}>
      {/* ── Animated background blobs ── */}
      <LinearGradient colors={['#0B0B18', '#101028', '#0A0A20']} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.blob, styles.blob1, { transform: [{ translateY: blob1Y }] }]} />
      <Animated.View style={[styles.blob, styles.blob2, { transform: [{ translateY: blob2Y }] }]} />
      <Animated.View style={[styles.blob, styles.blob3, { transform: [{ translateY: blob3Y }] }]} />

      {/* Subtle grid lines */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[styles.gridLine, { top: (height / 8) * i }]} />
        ))}
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <SafeAreaView style={styles.safe}>
          {/* ── Logo / Header ── */}
          <View style={styles.logoWrap}>
            <LinearGradient colors={['#6C63FF', '#9B59B6']} style={styles.logoCircle}>
              <Feather name="book-open" size={28} color="#fff" />
            </LinearGradient>
            <Text style={styles.appName}>YÖKDİL Çalışma</Text>
            <Text style={styles.appSub}>Akademik sınav hazırlığının en akıllı yolu</Text>
          </View>

          {/* ── Tabs ── */}
          <View style={styles.tabRow}>
            {(['login', 'register'] as const).map((m) => (
              <TouchableOpacity key={m} onPress={() => switchMode(m)} style={styles.tabBtn}>
                <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                  {m === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
                </Text>
                {mode === m && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Sliding panels ── */}
          <View style={styles.panelClip}>

            {/* LOGIN PANEL */}
            <Animated.View style={[styles.panel, { transform: [{ translateX: loginX }] }]}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <BlurView intensity={18} tint="dark" style={styles.card}>
                  <View style={styles.cardInner}>
                    <GoogleButton onPress={handleGooglePress} loading={googleLoading} />
                    <OrDivider />

                    <Animated.View style={{ transform: [{ translateX: loginShake.shakeX }] }}>
                      <AnimatedInput
                        icon="mail" placeholder="E-posta"
                        value={loginEmail} onChangeText={(v) => { setLoginEmail(v); setLoginErrors((e) => ({ ...e, email: false })); }}
                        keyboardType="email-address" hasError={loginErrors.email}
                        returnKeyType="next" onSubmitEditing={() => loginPwdRef.current?.focus()}
                      />
                      {loginErrors.email && (
                        <Text style={styles.fieldError}>Geçerli bir e-posta girin</Text>
                      )}
                      <AnimatedInput
                        icon="lock" placeholder="Şifre" isPassword
                        value={loginPassword} onChangeText={(v) => { setLoginPassword(v); setLoginErrors((e) => ({ ...e, password: false })); }}
                        hasError={loginErrors.password} inputRef={loginPwdRef}
                        returnKeyType="go" onSubmitEditing={handleLogin}
                      />
                      {loginErrors.password && (
                        <Text style={styles.fieldError}>En az 6 karakter</Text>
                      )}
                    </Animated.View>

                    <TouchableOpacity style={styles.forgotWrap} onPress={() => Haptics.selectionAsync()}>
                      <Text style={styles.forgotText}>Şifremi Unuttum</Text>
                    </TouchableOpacity>

                    {error && mode === 'login' && (
                      <View style={styles.errorBox}>
                        <Feather name="alert-circle" size={14} color="#F5576C" />
                        <Text style={styles.errorBoxText}>{error[0]}</Text>
                      </View>
                    )}

                    <PrimaryButton label="Giriş Yap" loading={isLoading} onPress={handleLogin} />

                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Hesabın yok mu? </Text>
                      <TouchableOpacity onPress={() => switchMode('register')}>
                        <Text style={styles.switchLink}>Kayıt Ol</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </BlurView>
              </ScrollView>
            </Animated.View>

            {/* REGISTER PANEL */}
            <Animated.View style={[styles.panel, { transform: [{ translateX: registerX }] }]}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <BlurView intensity={18} tint="dark" style={styles.card}>
                  <View style={styles.cardInner}>
                    <GoogleButton onPress={handleGooglePress} loading={googleLoading} />
                    <OrDivider />

                    <Animated.View style={{ transform: [{ translateX: regShake.shakeX }] }}>
                      <AnimatedInput
                        icon="user" placeholder="Ad Soyad"
                        value={regName} onChangeText={(v) => { setRegName(v); setRegErrors((e) => ({ ...e, name: false })); }}
                        autoCapitalize="words" hasError={regErrors.name}
                        returnKeyType="next" onSubmitEditing={() => regEmailRef.current?.focus()}
                      />
                      {regErrors.name && <Text style={styles.fieldError}>İsim en az 2 karakter</Text>}

                      <AnimatedInput
                        icon="mail" placeholder="E-posta"
                        value={regEmail} onChangeText={(v) => { setRegEmail(v); setRegErrors((e) => ({ ...e, email: false })); }}
                        keyboardType="email-address" hasError={regErrors.email}
                        returnKeyType="next" onSubmitEditing={() => regPwdRef.current?.focus()}
                        inputRef={regEmailRef}
                      />
                      {regErrors.email && <Text style={styles.fieldError}>Geçerli bir e-posta girin</Text>}

                      <AnimatedInput
                        icon="lock" placeholder="Şifre (en az 6 karakter)" isPassword
                        value={regPassword} onChangeText={(v) => { setRegPassword(v); setRegErrors((e) => ({ ...e, password: false, confirm: false })); }}
                        hasError={regErrors.password} inputRef={regPwdRef}
                        returnKeyType="next" onSubmitEditing={() => regConfirmRef.current?.focus()}
                      />
                      {regErrors.password && <Text style={styles.fieldError}>En az 6 karakter</Text>}

                      <AnimatedInput
                        icon="shield" placeholder="Şifre Tekrar" isPassword
                        value={regConfirm} onChangeText={(v) => { setRegConfirm(v); setRegErrors((e) => ({ ...e, confirm: false })); }}
                        hasError={regErrors.confirm} inputRef={regConfirmRef}
                        returnKeyType="go" onSubmitEditing={handleRegister}
                      />
                      {regErrors.confirm && <Text style={styles.fieldError}>Şifreler eşleşmiyor</Text>}
                    </Animated.View>

                    {error && mode === 'register' && (
                      <View style={styles.errorBox}>
                        <Feather name="alert-circle" size={14} color="#F5576C" />
                        <Text style={styles.errorBoxText}>{error[0]}</Text>
                      </View>
                    )}

                    <PrimaryButton label="Kayıt Ol" loading={isLoading} onPress={handleRegister} />

                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Zaten hesabın var mı? </Text>
                      <TouchableOpacity onPress={() => switchMode('login')}>
                        <Text style={styles.switchLink}>Giriş Yap</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </BlurView>
              </ScrollView>
            </Animated.View>

          </View>{/* panelClip */}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const CARD_RADIUS = 28;

const styles = StyleSheet.create({
  root:   { flex: 1 },
  kav:    { flex: 1 },
  safe:   { flex: 1, alignItems: 'center', paddingHorizontal: 20 },

  // ── Background blobs ──
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blob1: {
    width: 340, height: 340,
    top: -80, left: -120,
    backgroundColor: 'rgba(108,99,255,0.18)',
  },
  blob2: {
    width: 260, height: 260,
    bottom: 60, right: -80,
    backgroundColor: 'rgba(78,205,196,0.12)',
  },
  blob3: {
    width: 180, height: 180,
    top: height * 0.35, left: width * 0.55,
    backgroundColor: 'rgba(240,147,251,0.12)',
  },
  gridOverlay: { position: 'absolute', width: '100%', height: '100%' },
  gridLine: {
    position: 'absolute', width: '100%', height: 1,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  // ── Logo ──
  logoWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 20 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#6C63FF', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  appName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  appSub:  { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4, fontWeight: '400' },

  // ── Tabs ──
  tabRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
  tabTextActive: { color: '#fff' },
  tabIndicator: {
    position: 'absolute', bottom: 0, width: 32, height: 3,
    borderRadius: 2, backgroundColor: '#6C63FF',
  },

  // ── Sliding panels ──
  panelClip: {
    flex: 1, width: width - 40,
    overflow: 'hidden', position: 'relative',
  },
  panel: {
    position: 'absolute', width: '100%', top: 0, bottom: 0,
  },

  // ── Glassmorphism card ──
  card: {
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardInner: {
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  // ── Google button ──
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    paddingVertical: 13,
    gap: 10,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  googleIconCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  googleG: { fontSize: 14, fontWeight: '800', color: '#4285F4' },
  googleText: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },

  // ── Or divider ──
  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },

  // ── Input ──
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, height: 52,
    marginBottom: 12, gap: 10,
  },
  inputIcon: { flexShrink: 0 },
  input: {
    flex: 1, color: '#F0F2FF', fontSize: 15,
  },
  fieldError: {
    color: '#F5576C', fontSize: 11, fontWeight: '600',
    marginTop: -6, marginBottom: 8, marginLeft: 4,
  },
  forgotWrap: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { color: '#6C63FF', fontSize: 13, fontWeight: '600' },

  // ── Error box ──
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(245,87,108,0.12)', borderRadius: 10,
    padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(245,87,108,0.25)',
  },
  errorBoxText: { color: '#F5576C', fontSize: 13, flex: 1, fontWeight: '500' },

  // ── Primary button ──
  primaryBtnWrap: { marginBottom: 18 },
  primaryBtn: {
    borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6C63FF', shadowOpacity: 0.45,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  // ── Switch link ──
  switchRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  switchLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  switchLink:  { color: '#6C63FF', fontSize: 14, fontWeight: '700' },
});
