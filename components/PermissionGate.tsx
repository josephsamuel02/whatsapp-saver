import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  AppState,
  AppStateStatus,
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
  const [requestingSAF, setRequestingSAF] = useState(false);
  // true after the user tapped Allow and went to Settings (Android 11+)
  const [waitingReturn, setWaitingReturn] = useState(false);

  // onGranted changes identity every parent render (it's a plain function).
  // Depending on it would re-run the initial check after EVERY render and
  // call onGranted again → parent refresh → re-render → infinite scan loop.
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
        // re-checks when the user comes back. Keep the waiting label until then.
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

  async function handleSAF() {
    if (requestingSAF) return;
    setRequestingSAF(true);
    try {
      const { granted: ok } = await requestSAFPermission();
      if (ok) {
        setGranted(true);
        onGranted?.();
      }
    } finally {
      setRequestingSAF(false);
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
      {/* Icon */}
      <View style={s.iconRing}>
        <Ionicons name="shield-checkmark-outline" size={44} color={THEME.colors.primary} />
      </View>

      {/* Copy */}
      <Text style={s.title}>Allow Storage Access</Text>
      <Text style={s.body}>
        Status Saver needs permission to read your phone's storage so it can
        automatically find WhatsApp and WhatsApp Business statuses.
      </Text>

      {/* What it does */}
      <View style={s.infoBox}>
        <Row icon="checkmark-circle" text="Automatically scans all WhatsApp status folders" />
        <Row icon="checkmark-circle" text="Supports WhatsApp, WhatsApp Business & mods" />
        <Row icon="checkmark-circle" text="No folder selection needed — just tap Allow" />
        <Row icon="lock-closed"      text="Only reads status files — nothing else" />
      </View>

      {/* CTA */}
      <Pressable
        onPress={handleAllow}
        disabled={requesting || waitingReturn}
        style={[s.btn, (requesting || waitingReturn) && s.btnDim]}
      >
        {requesting || waitingReturn ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
        )}
        <Text style={s.btnText}>
          {waitingReturn
            ? 'Waiting for permission…'
            : isAndroid11Plus()
            ? 'Allow "All files access"'
            : 'Allow Storage Access'}
        </Text>
      </Pressable>

      {/* SAF fallback — Play-Store-friendly, no special permission needed */}
      <Pressable
        onPress={handleSAF}
        disabled={requestingSAF || waitingReturn}
        style={[s.btnSecondary, requestingSAF && s.btnDim]}
      >
        {requestingSAF ? (
          <ActivityIndicator color={THEME.colors.primary} size="small" />
        ) : (
          <Ionicons name="folder-open-outline" size={18} color={THEME.colors.primary} />
        )}
        <Text style={s.btnSecondaryText}>Or pick the .Statuses folder</Text>
      </Pressable>

      {/* Android 11+ clarification */}
      {isAndroid11Plus() && (
        <Text style={s.hint}>
          Android 11+ requires granting "All files access" in Settings. Tap Allow
          above — the Settings page will open, enable the toggle, then come back.
          {"\n"}Prefer the Play Store version? Use "pick the .Statuses folder"
          instead: choose Android → media → com.whatsapp → WhatsApp → Media →
          .Statuses (enable "Show hidden files" to see it).
        </Text>
      )}
    </View>
  );
}

function Row({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.row}>
      <Ionicons
        name={icon as any}
        size={16}
        color={icon === 'lock-closed' ? THEME.colors.textSecondary : THEME.colors.primary}
      />
      <Text style={s.rowText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#E7F8EC',
    borderWidth: 2,
    borderColor: '#C3F0CF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 24,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { flex: 1, fontSize: 13, color: THEME.colors.text, lineHeight: 18 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 999,
    width: '100%',
    elevation: 3,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  btnDim: { opacity: 0.65 },
  btnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#E7F8EC',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    width: '100%',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#C3F0CF',
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '800', color: THEME.colors.primary },
  hint: {
    marginTop: 16,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
});
