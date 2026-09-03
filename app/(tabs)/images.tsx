import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';
import { listStatuses, StatusFile, saveMultipleToGallery } from '../../lib/statusService';
import { hasSAFPermission, hasMediaLibraryPermission } from '../../lib/storageAccess';
import { StatusGrid } from '../../components/StatusGrid';
import { PreviewModal } from '../../components/PreviewModal';
import { PermissionGate } from '../../components/PermissionGate';

export default function ImagesScreen() {
  const [files, setFiles] = useState<StatusFile[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [selected, setSelected] = useState<StatusFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);

  async function checkAccess() {
    if (Platform.OS !== 'android') {
      setHasAccess(true);
      return;
    }
    
    try {
      const granted = await hasSAFPermission();
      setHasAccess(granted);
    } catch {
      setHasAccess(false);
    }
  }

  async function loadStatuses() {
    if (Platform.OS !== 'android') return;
    
    setLoading(true);
    try {
      const statuses = await listStatuses('image');
      setFiles(statuses);
    } catch (error) {
      console.error('Failed to load statuses:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    await checkAccess();
    await loadStatuses();
  }

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [])
  );

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

  async function handleSaveSelected() {
    if (selectedFiles.length === 0) return;
    
    // Check media library permission first
    const hasMediaPerm = await hasMediaLibraryPermission();
    if (!hasMediaPerm) {
      Alert.alert(
        'Permission Required',
        'Please allow photo library access to save images.',
        [{ text: 'OK' }]
      );
      return;
    }

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
    
    // Check media library permission first
    const hasMediaPerm = await hasMediaLibraryPermission();
    if (!hasMediaPerm) {
      Alert.alert(
        'Permission Required',
        'Please allow photo library access to save images.',
        [{ text: 'OK' }]
      );
      return;
    }

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
      {/* Show permission gate if no access */}
      {!hasAccess && <PermissionGate onGranted={refresh} />}

      {/* Show content if we have access */}
      {hasAccess && (
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
                    <Text style={s.hintText}>Long-press to select multiple</Text>
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
                onToggleSelect={toggleSelect}
                selectedIds={selection}
                selectionMode={isSelection}
                emptyText="No image statuses found. View some statuses in WhatsApp, then pull to refresh."
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
});
