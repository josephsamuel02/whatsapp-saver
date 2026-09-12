import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  ActivityIndicator,
  Platform,
  AppState,
  AppStateStatus,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import {
  hasStoragePermission,
  requestStoragePermission,
  openAllFilesAccessSettings,
  isAndroid11Plus,
  hasSAFPermission,
} from '../lib/storageAccess';

interface Props {
  onGranted?: () => void;
}

export function PermissionGate({ onGranted }: Props) {
  const [checking, setChecking] = useState(true);
  const [granted, setGranted] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [waitingReturn, setWaitingReturn] = useState(false);

  const onGrantedRef = useRef(onGranted);
  useEffect(() => {
    onGrantedRef.current = onGranted;
  }, [onGranted]);

  const autoPromptedRef = useRef(false);
  const waitingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (waitingTimer.current) clearTimeout(waitingTimer.current);
    };
  }, []);

  const check = useCallback(async () => {
    if (Platform.OS !== 'android') { setGranted(true); setChecking(false); return true; }
    try {
      const [direct, saf] = await Promise.all([
        hasStoragePermission(),
        hasSAFPermission(),
      ]);
      const ok = direct || saf;
      setGranted(ok);
      setWaitingReturn(false);
      if (ok) onGrantedRef.current?.();
      return ok;
    } catch {
      setGranted(false);
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await check();
      if (cancelled) return;
      if (!ok && !autoPromptedRef.current) {
        autoPromptedRef.current = true;
        setTimeout(() => {
          if (cancelled) return;
          Alert.alert(
            'Storage access needed',
            'Status Saver needs storage access to find your WhatsApp statuses. Grant it now?',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Allow', onPress: () => void handleAllow() },
            ],
            { cancelable: true }
          );
        }, 600);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [check]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'active') {
        if (waitingTimer.current) {
          clearTimeout(waitingTimer.current);
          waitingTimer.current = null;
        }
        setWaitingReturn(false);
        setChecking(true);
        await check();
      }
    });
    return () => sub.remove();
  }, [check]);

  function armWaitingFallback() {
    if (waitingTimer.current) clearTimeout(waitingTimer.current);
    waitingTimer.current = setTimeout(() => {
      waitingTimer.current = null;
      setWaitingReturn(false);
      setRequesting(false);
      void check();
    }, 3000);
  }

  async function handleAllow() {
    if (requesting || waitingReturn) return;
    setRequesting(true);
    try {
      if (isAndroid11Plus()) {
        setWaitingReturn(true);
        armWaitingFallback();
        try {
          await openAllFilesAccessSettings();
        } catch {
          setWaitingReturn(false);
        }
      } else {
        const ok = await requestStoragePermission();
        setGranted(ok);
        if (ok) onGrantedRef.current?.();
        else await check();
      }
    } finally {
      setRequesting(false);
    }
  }

  if (Platform.OS !== 'android') return null;

  if (granted) return null;

  const busy = requesting || waitingReturn;

  return (
    <View style={s.root}>
      <View style={s.iconWrap}>
        <Ionicons name="folder-open-outline" size={40} color={THEME.colors.primary} />
      </View>
      <Text style={s.title}>Storage access needed</Text>
      <Text style={s.sub}>
        To show your statuses, allow access to your WhatsApp status folder. Your files stay on your device.
      </Text>

      {checking ? (
        <View style={s.checkingRow}>
          <ActivityIndicator color={THEME.colors.primary} size="small" />
          <Text style={s.checkingText}>Checking access…</Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleAllow}
        disabled={busy}
        style={[s.btn, busy && s.btnDim]}
      >
        {busy ? <ActivityIndicator color="#fff" size="small" /> : null}
        <Text style={s.btnText}>
          {waitingReturn ? 'Waiting — enable access, then come back' : 'Allow Storage Access'}
        </Text>
      </Pressable>

      {waitingReturn ? (
        <Text style={s.hint}>
          After enabling the toggle, press Back to return here — the list refreshes automatically.
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: THEME.colors.background,
    gap: 10,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#D9EFDF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#BFE3C9',
  },
  title: { fontSize: 20, fontWeight: '800', color: THEME.colors.text, letterSpacing: -0.3 },
  sub: { fontSize: 13.5, color: THEME.colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 8, paddingHorizontal: 8 },
  checkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  checkingText: { fontSize: 12, fontWeight: '700', color: THEME.colors.textSecondary },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
    minWidth: 240,
    elevation: 3,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  btnDim: { opacity: 0.65 },
  btnText: { fontSize: 16, fontWeight: '800', color: '#fff', textAlign: 'center' },
  hint: { fontSize: 12, color: THEME.colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 16, lineHeight: 17 },
});
