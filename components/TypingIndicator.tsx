import { View } from 'react-native';
import { Colors } from '../constants/colors';

export default function TypingIndicator() {
  return (
    <View style={{ flexDirection: 'row', paddingLeft: 16, marginBottom: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginRight: 4 }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginRight: 4 }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent }} />
    </View>
  );
}
