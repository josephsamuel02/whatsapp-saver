import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { hasSAFPermission, requestSAFPermission } from '../lib/storageAccess';

interface PermissionGateProps {
  onGranted?: () => void;
}

export function PermissionGate({ onGranted }: PermissionGateProps) {
  const [checking, setChecking] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  async function checkPermission() {
    setChecking(true);
    try {
      const granted = await hasSAFPermission();
      setHasPermission(granted);
      if (granted && onGranted) {
        onGranted();
      }
    } catch (error) {
      setHasPermission(false);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkPermission();
  }, []);

  async function handleRequestPermission() {
    if (requesting) return;
    
    setRequesting(true);
    try {
      const granted = await requestSAFPermission();
      
      if (granted) {
        setHasPermission(true);
        if (onGranted) {
          onGranted();
        }
      }
      
      // Always recheck after request
      await checkPermission();
    } catch (error) {
      console.error('Permission request failed:', error);
    } finally {
      setRequesting(false);
    }
  }

  if (Platform.OS !== 'android') return null;
  if (checking) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator color={THEME.colors.primary} size="large" />
      </View>
    );
  }

  if (hasPermission) return null;

  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.card}>
        {/* Icon */}
        <View style={s.iconCircle}>
          <Ionicons name="folder-open" size={40} color={THEME.colors.primary} />
        </View>

        {/* Title */}
        <Text style={s.title}>Folder Access Required</Text>
        <Text style={s.subtitle}>
          To view WhatsApp statuses, you need to grant access to the WhatsApp Status folder
        </Text>

        {/* Instructions Toggle */}
        <Pressable 
          onPress={() => setShowInstructions(!showInstructions)}
          style={s.instructionsToggle}
        >
          <Ionicons 
            name={showInstructions ? "chevron-up" : "information-circle"} 
            size={18} 
            color={THEME.colors.primary} 
          />
          <Text style={s.instructionsToggleText}>
            {showInstructions ? "Hide Instructions" : "How does this work?"}
          </Text>
        </Pressable>

        {/* Expandable Instructions */}
        {showInstructions && (
          <View style={s.instructionsBox}>
            <Text style={s.instructionsTitle}>📁 Step-by-step guide:</Text>
            
            <View style={s.step}>
              <View style={s.stepNumber}><Text style={s.stepNumberText}>1</Text></View>
              <Text style={s.stepText}>Tap "Select Folder" below</Text>
            </View>

            <View style={s.step}>
              <View style={s.stepNumber}><Text style={s.stepNumberText}>2</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepText}>Navigate to one of these paths:</Text>
                <Text style={s.stepPath}>• Android → media → com.whatsapp → WhatsApp → Media → .Statuses</Text>
                <Text style={s.stepPath}>• WhatsApp → Media → .Statuses</Text>
              </View>
            </View>

            <View style={s.step}>
              <View style={s.stepNumber}><Text style={s.stepNumberText}>3</Text></View>
              <Text style={s.stepText}>Tap "Use this folder" or "Allow"</Text>
            </View>

            <View style={s.noteBox}>
              <Ionicons name="information-circle" size={16} color="#F59E0B" />
              <Text style={s.noteText}>
                The .Statuses folder may be hidden. Look for "Show hidden files" option in folder picker.
              </Text>
            </View>

            <View style={s.noteBox}>
              <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
              <Text style={s.noteText}>
                For WhatsApp Business, look for com.whatsapp.w4b instead of com.whatsapp
              </Text>
            </View>
          </View>
        )}

        {/* Action Button */}
        <Pressable
          onPress={handleRequestPermission}
          disabled={requesting}
          style={[s.button, requesting && s.buttonDisabled]}
        >
          {requesting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="folder-open-outline" size={20} color="#fff" />
          )}
          <Text style={s.buttonText}>
            {requesting ? "Opening folder picker..." : "Select Folder"}
          </Text>
        </Pressable>

        {/* Why SAF explanation */}
        <View style={s.whyBox}>
          <Text style={s.whyTitle}>Why is this needed?</Text>
          <Text style={s.whyText}>
            Android 11+ requires apps to request specific folder access for security. 
            This ensures only you can grant access to your WhatsApp statuses.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: THEME.colors.background,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  instructionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  instructionsToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  instructionsBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 8,
  },
  step: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.text,
    lineHeight: 20,
  },
  stepPath: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: THEME.colors.textSecondary,
    backgroundColor: '#fff',
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    marginBottom: 16,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  whyBox: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.primary,
  },
  whyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 4,
  },
  whyText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
});
