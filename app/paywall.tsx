import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { PurchasesPackage } from 'react-native-purchases';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { getCurrentOffering, isPurchasesConfigured, purchase, restore } from '@/lib/purchases';
import { useApp } from '@/context/AppContext';

const BENEFITS = [
  'Unlimited history — every night, forever',
  'Photos and voice notes in your ritual',
  'Full widget customization',
  'One subscription covers both of you',
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshSharedState } = useApp();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isPurchasesConfigured()) {
        setLoading(false);
        return;
      }
      try {
        const offering = await getCurrentOffering();
        const available = offering?.availablePackages ?? [];
        setPackages(available);
        setSelected(available[0] ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePurchase = async () => {
    if (!selected || purchasing) return;
    setPurchasing(true);
    try {
      const entitled = await purchase(selected);
      if (entitled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshSharedState().catch(() => {});
        router.back();
      }
    } catch (error: any) {
      if (!error?.userCancelled) {
        Alert.alert('Could not complete purchase', error?.message ?? 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const entitled = await restore();
      if (entitled) {
        await refreshSharedState().catch(() => {});
        router.back();
      } else {
        Alert.alert('No active subscription found', 'Restore looked for a previous purchase on this account but did not find one.');
      }
    } catch (error: any) {
      Alert.alert('Could not restore purchases', error?.message ?? 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <LinearGradient colors={['#0F0C29', '#1A1635', '#24243E']} style={styles.container}>
      <StarField />
      <Pressable style={[styles.closeButton, { top: insets.top + 12 }]} onPress={() => router.back()}>
        <Ionicons name="close" size={22} color="#9B89C2" />
      </Pressable>

      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={28} color="#FF9A8B" />
          <Text style={styles.title}>Lunara Premium</Text>
          <Text style={styles.subtitle}>One subscription, unlocked for both of you</Text>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={18} color="#A8D8A8" />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color="#FF9A8B" style={{ marginVertical: 24 }} />
        ) : packages.length === 0 ? (
          <Text style={styles.noOfferings}>
            Subscription plans aren&apos;t configured yet. Add products in RevenueCat and they&apos;ll appear here.
          </Text>
        ) : (
          <View style={styles.packages}>
            {packages.map((pkg) => {
              const isSelected = selected?.identifier === pkg.identifier;
              return (
                <Pressable
                  key={pkg.identifier}
                  style={[styles.packageOption, isSelected && styles.packageOptionSelected]}
                  onPress={() => setSelected(pkg)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.packageTitle}>{pkg.product.title || pkg.identifier}</Text>
                    <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color="#FF9A8B" />}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.footer}>
          <LunaraButton
            title="Subscribe"
            onPress={handlePurchase}
            loading={purchasing}
            disabled={!selected}
          />
          <Pressable onPress={handleRestore} disabled={purchasing} style={styles.restoreBtn}>
            <Text style={styles.restoreText}>Restore purchases</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeButton: {
    position: 'absolute',
    right: 22,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#1E1B3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flex: 1, paddingHorizontal: 26, justifyContent: 'space-between' },
  header: { alignItems: 'center', gap: 8, marginBottom: 28 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#F8F5FF' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#9B89C2', textAlign: 'center' },
  benefits: { gap: 14, marginBottom: 28 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#E8E0FF', flex: 1 },
  noOfferings: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
    textAlign: 'center',
    lineHeight: 19,
    marginVertical: 24,
  },
  packages: { gap: 12, marginBottom: 12 },
  packageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#1E1B3A',
  },
  packageOptionSelected: {
    borderColor: 'rgba(255,154,139,0.45)',
    backgroundColor: 'rgba(255,154,139,0.08)',
  },
  packageTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#F8F5FF' },
  packagePrice: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#9B89C2', marginTop: 2 },
  footer: { gap: 12, marginTop: 8 },
  restoreBtn: { alignItems: 'center', paddingVertical: 8 },
  restoreText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#9B89C2' },
});
