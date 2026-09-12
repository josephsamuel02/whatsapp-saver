import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { THEME } from '../../constants/theme';
import { listStatuses, StatusFile } from '../../lib/statusService';
import { hasStoragePermission, hasSAFPermission } from '../../lib/storageAccess';
import { StatusGrid } from '../../components/StatusGrid';
import { PreviewModal } from '../../components/PreviewModal';
import { PermissionGate } from '../../components/PermissionGate';
import { EmptyAccessAction } from '../../components/EmptyAccessAction';

export default function ImagesScreen() {
  const [files, setFiles] = useState<StatusFile[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const checkAccess = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      if (mounted.current) {
        setHasAccess(true);
        setAccessChecked(true);
      }
      return true;
    }

    try {
      const [direct, saf] = await Promise.all([hasStoragePermission(), hasSAFPermission()]);
      const ok = direct || saf;
      if (mounted.current) {
        setHasAccess(ok);
        setAccessChecked(true);
        if (!ok) setFiles([]);
      }
      return ok;
    } catch {
      if (mounted.current) {
        setHasAccess(false);
        setAccessChecked(true);
        setFiles([]);
      }
      return false;
    }
  }, []);

  const loadStatuses = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    if (mounted.current) setLoading(true);
    try {
      const statuses = await listStatuses('image');
      if (mounted.current) setFiles(statuses);
    } catch (error) {
      console.error('Failed to load statuses:', error);
      if (mounted.current) setFiles([]);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const ok = await checkAccess();
    if (ok) {
      await loadStatuses();
    } else if (mounted.current) {
      setLoading(false);
    }
  }, [checkAccess, loadStatuses]);

  const onPullRefresh = useCallback(async () => {
    if (!mounted.current) return;
    setRefreshing(true);
    try {
      const ok = await checkAccess();
      if (ok) {
        const statuses = await listStatuses('image');
        if (mounted.current) setFiles(statuses);
      }
    } catch (error) {
      console.error('Failed to load statuses:', error);
      if (mounted.current) setFiles([]);
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [checkAccess]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const handlePress = (f: StatusFile) => {
    const idx = files.findIndex((x) => x.uri === f.uri);
    setSelectedIndex(idx >= 0 ? idx : null);
  };

  if (Platform.OS !== 'android') {
    return (
      <View style={s.center}>
        <Text style={s.title}>Android Only</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      {!accessChecked || !hasAccess ? (
        <PermissionGate onGranted={refresh} />
      ) : (
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color={THEME.colors.primary} />
            </View>
          ) : (
            <StatusGrid
              data={files}
              onPress={handlePress}
              refreshing={refreshing || loading}
              onRefresh={onPullRefresh}
              emptyText="View statuses in WhatsApp, then pull to refresh."
              emptyAction={<EmptyAccessAction onChanged={refresh} />}
            />
          )}
        </View>
      )}

      <PreviewModal files={files} index={selectedIndex} onClose={() => setSelectedIndex(null)} onIndexChange={setSelectedIndex} />
    </View>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: THEME.colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.text,
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});
