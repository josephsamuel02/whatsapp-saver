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
} from 'react-native';
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
  // true after the user tapped Allow and went to Settings (Android 11+)
  const [waitingReturn, setWaitingReturn] = useState(false);

  // onGranted changes identity every parent render (it's a plain function).
  // Keep it in a ref so `check` stays stable.
  const onGrantedRef = useRef(onGranted);
  useEffect(() => {
    onGrantedRef.current = onGranted;
  }, [onGranted]);

  const check = useCallback(async () => {
    if (Platform.OS !== 'android') { setGranted(true); setChecking(false); return; }
    try {
      const [direct, saf] = await Promise.all([
        hasStoragePermission(),
        hasSAFPermission(),
      ]);
      const ok = direct || saf;
      setGranted(ok);
      if (ok) onGrantedRef.current?.();
    } catch {
      setGranted(false);
    } finally {
      setChecking(false);
    }
  }, []);

  // Initial check
  useEffect(() => { check(); }, [check]);

  // Re-check whenever the app returns to foreground (user coming back from
  // system Settings or the folder picker). This subscription is ALWAYS active —
  // previously it only existed while `waitingReturn` was true, so grants made
  // outside that narrow window looked like "permission failing / not persistent".
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'active') {
        setWaitingReturn(false);
        setChecking(true);
        await check();
      }
    });
    return () => sub.remove();
  }, [check]);

  async function handleAllow() {
    if (requesting) return;
    setRequesting(true);
    try {
      if (isAndroid11Plus()) {
        // Opens system settings; the ALWAYS-ON AppState listener above
        // re-checks when the user comes back.
        setWaitingReturn(true);
        try {
          await openAllFilesAccessSettings();
        } catch {
          setWaitingReturn(false);
        }
      } else {
        const ok = await requestStoragePermission();
        setGranted(ok);
        if (ok) onGranted?.();
      }
    } finally {
      setRequesting(false);
    }
  }

  if (Platform.OS !== 'android') return null;

  if (checking) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={THEME.colors.primary} size="large" />
      </View>
    );
  }

  if (granted) return null;

  return (
    <View style={s.root}>
      <Pressable
        onPress={handleAllow}
        disabled={requesting || waitingReturn}
        style={[s.btn, (requesting || waitingReturn) && s.btnDim]}
      >
        {(requesting || waitingReturn) ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : null}
        <Text style={s.btnText}>Open File Access</Text>
      </Pressable>
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
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
    minWidth: 220,
    elevation: 3,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  btnDim: { opacity: 0.65 },
  btnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
