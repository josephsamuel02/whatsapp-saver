import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { THEME } from '../constants/theme';
import type { StatusFile } from '../lib/statusService';
import { saveToGallery, shareFile, shareToWhatsApp } from '../lib/statusService';

export function PreviewModal({ file, onClose }: { file: StatusFile | null; onClose: () => void }) {
  const [saving, setSaving] = useState(false);

  const player = file?.type === 'video' ? useVideoPlayer(file.uri, (p: any) => {
    p.loop = false;
    p.muted = false;
  }) : null;

  useEffect(() => {
    if (player && file?.type === 'video') {
      player.play();
      return () => {
        player.pause();
      };
    }
  }, [player, file?.type, file?.uri]);

  if (!file) return null;

  async function handleSave() {
    try {
      setSaving(true);
      await saveToGallery(file!.uri);
      Alert.alert('Saved', 'Saved to gallery • Album: Status Saver');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Check storage permission');
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    try {
      await shareFile(file!.uri);
    } catch (e: any) {
      Alert.alert('Share failed', e?.message ?? 'Try again');
    }
  }

  async function handleShareToWhatsApp() {
    try {
      await shareToWhatsApp(file!.uri);
    } catch (e: any) {
      Alert.alert('Share to WhatsApp failed', e?.message ?? 'Try again');
    }
  }

  return (
    <Modal visible={!!file} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* media */}
        <View style={styles.mediaWrap}>
          {file.type === 'image' ? (
            <Image source={{ uri: file.uri }} style={styles.image} resizeMode="contain" />
          ) : (
            <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
          )}
        </View>

        {/* top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* bottom actions */}
        <View style={styles.bottomBar}>
          <Pressable onPress={handleShare} style={styles.actionBtn}>
            <Ionicons name="share-outline" size={20} color="#fff" />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
          <Pressable onPress={handleShareToWhatsApp} style={styles.actionBtn}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </Pressable>
          <Pressable onPress={handleSave} disabled={saving} style={[styles.actionBtn, styles.saveBtn]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="download-outline" size={20} color="#fff" />}
            <Text style={styles.actionText}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  mediaWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  video: { width: '100%', height: '100%' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 48, paddingHorizontal: 12, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  fileName: { flex: 1, color: '#fff', textAlign: 'center', fontSize: 13, marginHorizontal: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 14,
  },
  saveBtn: { backgroundColor: THEME.colors.primary },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
