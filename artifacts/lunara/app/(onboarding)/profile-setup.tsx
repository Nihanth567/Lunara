import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { normalizeRecoveryPhone, useApp } from '@/context/AppContext';

const PRONOUNS = ['he/him', 'she/her', 'they/them', 'he/they', 'she/they', 'prefer not to say'];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accountKey, setUser, user } = useApp();

  const [name, setName] = useState(user?.name === 'You' ? '' : user?.name ?? '');
  const [pronouns, setPronouns] = useState(user?.pronouns ?? '');
  const [birthday, setBirthday] = useState(user?.birthday ?? '');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = name.trim().length >= 2
    && (Boolean(accountKey) || (
      normalizeRecoveryPhone(recoveryPhone).length >= 8
      && backupCode.length >= 6
    ));

  const handleContinue = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await setUser({
        id: user?.id ?? generateId(),
        name: name.trim(),
        birthday: birthday || undefined,
        pronouns: pronouns || undefined,
      }, recoveryPhone || undefined, backupCode || undefined);
      router.push('/(onboarding)/pairing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0F0C29', '#1A1635', '#24243E']} style={styles.container}>
      <StarField />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
           <Animated.View style={styles.header}>
            <Text style={styles.eyebrow}>Almost there</Text>
            <Text style={styles.title}>Tell us a little{'\n'}about yourself</Text>
            <Text style={styles.subtitle}>
              Just your first name or nickname — this is what your partner will see
            </Text>
          </Animated.View>

           <Animated.View style={styles.form}>
            {/* Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Your name or nickname</Text>
              <TextInput
                style={[styles.input, name.length > 0 && styles.inputFilled]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Alex, Mia, Sunshine..."
                placeholderTextColor="rgba(255,255,255,0.22)"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={24}
              />
            </View>

             {!accountKey && (
               <View style={styles.backupFields}>
                 <View style={styles.field}>
                   <Text style={styles.label}>Phone number</Text>
                   <Text style={styles.fieldNote}>Used to find your private backup if you reinstall.</Text>
                   <TextInput
                     style={[styles.input, recoveryPhone.length > 0 && styles.inputFilled]}
                     value={recoveryPhone}
                     onChangeText={setRecoveryPhone}
                     placeholder="+1 (555) 000-0000"
                     placeholderTextColor="rgba(255,255,255,0.22)"
                     keyboardType="phone-pad"
                     maxLength={24}
                   />
                 </View>
                 <View style={styles.field}>
                   <Text style={styles.label}>Private backup code</Text>
                   <Text style={styles.fieldNote}>Choose at least 6 characters. You’ll need it to restore your history.</Text>
                   <TextInput
                     style={[styles.input, backupCode.length > 0 && styles.inputFilled]}
                     value={backupCode}
                     onChangeText={setBackupCode}
                     placeholder="Create a private code"
                     placeholderTextColor="rgba(255,255,255,0.22)"
                     secureTextEntry
                     autoCapitalize="none"
                     autoCorrect={false}
                     maxLength={64}
                   />
                 </View>
               </View>
             )}

            {/* Birthday */}
            <View style={styles.field}>
              <Text style={styles.label}>Birthday (optional)</Text>
              <Text style={styles.fieldNote}>Used for age verification and anniversary reminders</Text>
              <TextInput
                style={styles.input}
                value={birthday}
                onChangeText={setBirthday}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="rgba(255,255,255,0.22)"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>

            {/* Pronouns */}
            <View style={styles.field}>
              <Text style={styles.label}>Pronouns (optional)</Text>
              <View style={styles.pronounsGrid}>
                {PRONOUNS.map((p) => (
                  <Pressable
                    key={p}
                    style={[
                      styles.pronounPill,
                      pronouns === p && styles.pronounPillActive,
                    ]}
                    onPress={() => setPronouns(pronouns === p ? '' : p)}
                  >
                    <Text
                      style={[
                        styles.pronounText,
                        pronouns === p && styles.pronounTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Animated.View>

           <Animated.View>
            <LunaraButton
              title="Continue"
              onPress={handleContinue}
              disabled={!isValid}
              loading={loading}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 26, gap: 28 },
  header: { gap: 8 },
  eyebrow: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#FF9A8B',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    lineHeight: 22,
  },
  form: { gap: 20 },
  backupFields: { gap: 20 },
  field: { gap: 6 },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#C3B1E1',
  },
  fieldNote: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
    lineHeight: 16,
    marginBottom: 2,
  },
  input: {
     backgroundColor: '#1E1B3A',
     borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#F8F5FF',
  },
  inputFilled: {
    borderColor: 'rgba(255,154,139,0.35)',
    backgroundColor: 'rgba(255,154,139,0.07)',
  },
  pronounsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pronounPill: {
     borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pronounPillActive: {
    borderColor: 'rgba(195,177,225,0.5)',
    backgroundColor: 'rgba(195,177,225,0.12)',
  },
  pronounText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
  },
  pronounTextActive: {
    color: '#C3B1E1',
    fontFamily: 'Inter_500Medium',
  },
});
