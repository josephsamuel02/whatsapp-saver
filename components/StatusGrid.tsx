import React from 'react';
import { View, FlatList, Pressable, Image, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import type { StatusFile } from '../lib/statusService';

const GAP = 2;
const COLS = 3;
const ITEM = (Dimensions.get('window').width - GAP * (COLS - 1)) / COLS;

export function StatusGrid({
  data,
  onPress,
  emptyText,
}: {
  data: StatusFile[];
  onPress: (f: StatusFile) => void;
  emptyText: string;
}) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="images-outline" size={48} color={THEME.colors.textMuted} />
        <Text style={styles.emptyTitle}>No items yet</Text>
        <Text style={styles.emptySub}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={data}
      keyExtractor={(i) => i.uri}
      numColumns={COLS}
      contentContainerStyle={{ gap: GAP, paddingBottom: 24 }}
      columnWrapperStyle={{ gap: GAP }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onPress(item)}
          style={styles.cell}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Image source={{ uri: item.uri }} style={styles.thumb} />
          {item.type === 'video' && (
            <View style={styles.videoBadge}>
              <Ionicons name="play" size={14} color="#fff" />
            </View>
          )}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  cell: { width: ITEM, height: ITEM, backgroundColor: '#ddd', overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: THEME.colors.text },
  emptySub: { fontSize: 14, color: THEME.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
