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
  requestSAFPermission,
} from '../lib/storageAccess';

interface Props {
  onGranted?: () => void;
}

export function PermissionGate({ onGranted }: Props) {
  const [checking, setChecking] = useState(true);
  const [granted, setGranted] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);
  // true after the user tapped Allow and went to Settings (Android 11+)
  const [waitingReturn, setWaitingReturn] = useState(false);

  // onGranted changes identity every parent render (it's a plain function).
  // Keep it in a ref so `check` stays stable.
  const onGrantedRef = useRef(onGranted);
  useEffect(() => {
    onGrantedRef.current = onGranted;
  }, [onGranted]);

  // Fix #1: auto-prompt only once per mount (first open with no access).
  const autoPromptedRef = useRef(false);
  // Fix #4: fallback timer — if the AppState 'active' event is missed
  // (picker/Settings overlay didn't background the app), the button would
  // stay stuck on a spinner and the user force-kills the app ("it closed").
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

  // Initial check + Fix #1 auto-prompt on first open
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await check();
      if (cancelled) return;
      if (!ok && !autoPromptedRef.current) {
        autoPromptedRef.current = true;
        // Small delay so the permission screen paints first, then prompt.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check]);

  // Re-check whenever the app returns to foreground (user coming back from
  // system Settings or the folder picker). This subscription is ALWAYS active —
  // previously it only existed while `waitingReturn` was true, so grants made
  // outside that narrow window looked like "permission failing / not persistent".
  // Fix #4: only refresh state here — never reload/restart the app.
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
    // If AppState never fires (overlay picker), re-enable + re-check anyway.
    waitingTimer.current = setTimeout(() => {
      waitingTimer.current = null;
      setWaitingReturn(false);
      setRequesting(false);
      void check();
    }, 3000);
  }

  // Fix #1: explicit storage-access button.
  async function handleAllow() {
    if (requesting || waitingReturn) return;
    setRequesting(true);
    try {
      if (isAndroid11Plus()) {
        // Opens system settings; the ALWAYS-ON AppState listener above
        // re-checks when the user comes back. Fix #4: arm a fallback so a
        // missed AppState event can't leave the UI stuck (user kills app).
        setWaitingReturn(true);
        armWaitingFallback();
        try {
          await openAllFilesAccessSettings();
        } catch {
          setWaitingReturn(false);
        }
        // NOTE: do NOT re-check immediately here — the user hasn't acted yet
        // (Settings is on screen). The AppState/fallback re-check handles it,
        // which is what makes the grant "refresh instead of close".
      } else {
        const ok = await requestStoragePermission();
        setGranted(ok);
        if (ok) onGrantedRef.current?.();
        else await check();
      }
    } finally {
      // On Android 11+ keep `requesting` false but leave `waitingReturn`
      // spinner until AppState/fallback clears it.
      if (!isAndroid11Plus()) setRequesting(false);
      else setRequesting(false);
    }
  }

  // Fix #4: SAF folder picker stays inside the app (no Settings task-switch),
  // so granting through here can never look like "the app closed".
  async function handlePickFolder() {
    if (pickingFolder || requesting) return;
    setPickingFolder(true);
    try {
      const { granted: ok } = await requestSAFPermission();
      if (ok) {
        await check();
      }
    } catch {
      // picker cancelled — stay on the gate, don't close anything
    } finally {
      setPickingFolder(false);
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

      {/* Fix #1: the explicit "ask for storage access" button */}
      <Pressable
        onPress={handleAllow}
        disabled={busy || pickingFolder}
        style={[s.btn, (busy || pickingFolder) && s.btnDim]}
      >
        {busy ? <ActivityIndicator color="#fff" size="small" /> : null}
        <Text style={s.btnText}>
          {waitingReturn ? 'Waiting — enable access, then come back' : 'Allow Storage Access'}
        </Text>
      </Pressable>

      <Text style={s.or}>or</Text>

      {/* In-app fallback: never leaves the app, so it can't "close" it */}
      <Pressable
        onPress={handlePickFolder}
        disabled={busy || pickingFolder}
        style={[s.btnSecondary, (busy || pickingFolder) && s.btnDim]}
      >
        {pickingFolder ? (
          <ActivityIndicator color={THEME.colors.primary} size="small" />
        ) : (
          <Ionicons name="folder-outline" size={18} color={THEME.colors.primary} />
        )}
        <Text style={s.btnSecondaryText}>Pick the .Statuses folder</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
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
  or: { fontSize: 13, fontWeight: '700', color: THEME.colors.textMuted, marginTop: 2 },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    minWidth: 240,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '800', color: THEME.colors.primary },
  hint: { fontSize: 12, color: THEME.colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 16, lineHeight: 17 },
});
