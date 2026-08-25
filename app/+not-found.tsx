import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#0F0C29', '#1A1635', '#302B63', '#1A1635', '#0F0C29']}
        locations={[0, 0.3, 0.55, 0.8, 1]}
        style={styles.container}
      >
        <StarField />
        <View style={styles.content}>
          <Ionicons name="moon-outline" size={30} color="#C3B1E1" />
          <Text style={styles.title}>This page drifted off somewhere</Text>
          <Text style={styles.body}>
            Whatever you were looking for isn’t here — but Lunara is, right where you left it.
          </Text>
          <Link href="/" style={styles.link}>
            <Text style={styles.linkText}>Take me home</Text>
          </Link>
        </View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 14,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: '#F8F5FF',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    textAlign: 'center',
    lineHeight: 21,
  },
  link: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  linkText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#C3B1E1',
  },
});
