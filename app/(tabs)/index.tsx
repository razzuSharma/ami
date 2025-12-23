import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';

export default function HomeTab() {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animateButton = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(callback);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgPrimary, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
      <Text className='text-3xl text-textPrimary font-bold mb-8 text-center'>
        Hi… I’m here for you
      </Text>

      <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '80%', marginBottom: 16 }}>
        <TouchableOpacity
          style={{
            backgroundColor: Colors.accent,
            paddingVertical: 16,
            borderRadius: 32,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
            elevation: 6,
            alignItems: 'center',
          }}
          onPress={() => animateButton(() => router.push('/chat'))}
        >
          <Text style={{ color: Colors.bgPrimary, fontSize: 18, fontWeight: '500' }}>Talk to me</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '80%' }}>
        <TouchableOpacity
          style={{
            backgroundColor: Colors.card,
            paddingVertical: 16,
            borderRadius: 32,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
            alignItems: 'center',
          }}
          onPress={() => animateButton(() => router.push('/journal'))}
        >
          <Text style={{ color: Colors.textPrimary, fontSize: 18, fontWeight: '500' }}>Write something</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
