import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, Alert, ActivityIndicator, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';
import { listStatuses, StatusFile, saveMultipleToGallery } from '../../lib/statusService';
import { hasStoragePermission, hasMediaLibraryPermission, hasSAFPermission, requestMediaLibraryPermission, requestSAFPermission, openAllFilesAccessSettings } from '../../lib/storageAccess';
import { StatusGrid } from '../../components/StatusGrid';
import { PreviewModal } from '../../components/PreviewModal';
import { PermissionGate } from '../../components/PermissionGate';

export default function ImagesScreen() {
  const [files, setFiles] = useState<StatusFile[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [selected, setSelected] = useState<StatusFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [fixingAccess, setFixingAccess] = useState(false);
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

  // Re-check when returning from system Settings / folder picker — makes the
  // grant stick instead of showing the permission gate again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  async function handleRepickFolder() {
    if (fixingAccess) return;
    setFixingAccess(true);
    try {
      const { granted } = await requestSAFPermission();
      if (granted) {
        await refresh();
      }
    } finally {
      setFixingAccess(false);
    }
  }

  const isSelection = selection.size > 0;
  
  const toggleSelect = (f: StatusFile) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(f.uri)) {
        next.delete(f.uri);
      } else {
        next.add(f.uri);
      }
      return next;
    });
  };

  const clearSelection = () => setSelection(new Set());
  const selectedFiles = files.filter((f) => selection.has(f.uri));

  async function ensureMediaPermission(): Promise<boolean> {
    const hasMediaPerm = await hasMediaLibraryPermission();
    if (hasMediaPerm) return true;
    // Actually request it instead of just telling the user to go to Settings
    const req = await requestMediaLibraryPermission();
    if (!req) {
      Alert.alert(
        'Permission Required',
        'Please allow photo library access to save images. You can enable it in Settings.',
        [{ text: 'OK' }]
      );
    }
    return req;
  }

  async function handleSaveSelected() {
    if (selectedFiles.length === 0) return;

    if (!(await ensureMediaPermission())) return;

    setSavingAll(true);
    try {
      const result = await saveMultipleToGallery(selectedFiles);
      Alert.alert(
        'Saved',
        `${result.saved} image${result.saved !== 1 ? 's' : ''} saved to Gallery • Album: Status Saver${
          result.errors ? ` • ${result.errors} failed` : ''
        }`
      );
      clearSelection();
    } catch (error: any) {
      Alert.alert('Save Failed', error?.message || 'Could not save images');
    } finally {
      setSavingAll(false);
    }
  }

  async function handleSaveAll() {
    if (files.length === 0) return;

    if (!(await ensureMediaPermission())) return;

    setSavingAll(true);
    try {
      const result = await saveMultipleToGallery(files);
      Alert.alert(
        'Saved',
        `${result.saved} image${result.saved !== 1 ? 's' : ''} saved to Gallery • Album: Status Saver${
          result.errors ? ` • ${result.errors} failed` : ''
        }`
      );
    } catch (error: any) {
      Alert.alert('Save Failed', error?.message || 'Could not save images');
    } finally {
      setSavingAll(false);
    }
  }

  // Non-Android platform
  if (Platform.OS !== 'android') {
    return (
      <View style={s.center}>
        <View style={s.centerIcon}>
          <Ionicons name="phone-portrait-outline" size={48} color={THEME.colors.primary} />
        </View>
        <Text style={s.title}>Android Only</Text>
        <Text style={s.sub}>
          iOS cannot access WhatsApp's files due to system sandboxing. 
          Please use this app on an Android device.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      {/* Still checking permissions — avoid flashing the gate on every start */}
      {!accessChecked ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={s.loadingText}>Checking access...</Text>
        </View>
      ) : !hasAccess ? (
        <PermissionGate onGranted={refresh} />
      ) : (
        <>
          {/* Header with stats and refresh */}
          <View style={s.header}>
            <View style={s.statsRow}>
              <View style={s.iconBadge}>
                <Ionicons name="images" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statsCount}>
                  {loading ? '...' : `${files.length} image${files.length !== 1 ? 's' : ''}`}
                </Text>
                <Text style={s.statsLabel}>WhatsApp Statuses</Text>
              </View>
              <Pressable onPress={refresh} style={s.refreshBtn} disabled={loading}>
                <Ionicons name="refresh" size={18} color={THEME.colors.primary} />
                <Text style={s.refreshText}>Refresh</Text>
              </Pressable>
            </View>

            {/* Action bar */}
            {files.length > 0 && (
              <View style={s.actionBar}>
                {isSelection ? (
                  <>
                    <Pressable onPress={clearSelection} style={s.actionSecondary}>
                      <Text style={s.actionSecondaryText}>Clear ({selection.size})</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSaveSelected}
                      disabled={savingAll}
                      style={[s.actionPrimary, savingAll && s.actionDisabled]}
                    >
                      {savingAll ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Ionicons name="download" size={16} color="#fff" />
                      )}
                      <Text style={s.actionPrimaryText}>Save Selected</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={s.hintText}>Tap to view • long-press or ✓ to select</Text>
                    <Pressable
                      onPress={handleSaveAll}
                      disabled={savingAll}
                      style={[s.actionPrimary, savingAll && s.actionDisabled]}
                    >
                      {savingAll ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Ionicons name="download-outline" size={16} color="#fff" />
                      )}
                      <Text style={s.actionPrimaryText}>Save All</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Status grid or loading */}
          <View style={{ flex: 1 }}>
            {loading ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={THEME.colors.primary} />
                <Text style={s.loadingText}>Scanning WhatsApp folders...</Text>
              </View>
            ) : (
              <StatusGrid
                data={files}
                onPress={setSelected}
                onLongPress={toggleSelect}
                onToggleSelect={toggleSelect}
                selectedIds={selection}
                selectionMode={isSelection}
                refreshing={refreshing || loading}
                onRefresh={onPullRefresh}
                emptyText="No image statuses found. View some statuses in WhatsApp, then pull to refresh. If you already picked a folder, you may have picked the wrong level — try picking the .Statuses folder again."
                emptyAction={
                  <View style={{ gap: 8 }}>
                    <Pressable
                      onPress={handleRepickFolder}
                      disabled={fixingAccess}
                      style={[s.fixBtn, fixingAccess && { opacity: 0.6 }]}
                    >
                      {fixingAccess ? (
                        <ActivityIndicator color={THEME.colors.primary} size="small" />
                      ) : (
                        <Ionicons name="folder-open-outline" size={16} color={THEME.colors.primary} />
                      )}
                      <Text style={s.fixBtnText}>Pick .Statuses folder again</Text>
                    </Pressable>
                    <Pressable onPress={() => openAllFilesAccessSettings()} style={s.fixBtnGhost}>
                      <Ionicons name="settings-outline" size={15} color={THEME.colors.textSecondary} />
                      <Text style={s.fixBtnGhostText}>Open "All files access" settings</Text>
                    </Pressable>
                  </View>
                }
              />
            )}
          </View>
        </>
      )}

      {/* Preview Modal */}
      <PreviewModal file={selected} onClose={() => setSelected(null)} />
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
  centerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E7F8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#C3F0CF',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.text,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCount: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  statsLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    alignSelf: 'center',
  },
  actionSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: THEME.colors.primary,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  fixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E7F8EC',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C3F0CF',
  },
  fixBtnText: { color: THEME.colors.primary, fontSize: 13.5, fontWeight: '800' },
  fixBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  fixBtnGhostText: { color: THEME.colors.textSecondary, fontSize: 12.5, fontWeight: '700' },
});
