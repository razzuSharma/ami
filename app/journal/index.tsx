import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';

export default function JournalScreen() {
  const [entry, setEntry] = useState('');
  const [entries, setEntries] = useState<string[]>([]);

  const saveEntry = () => {
    if (!entry.trim()) return;
    setEntries([entry, ...entries]);
    setEntry('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgPrimary, padding: 16 }}>
      <TextInput
        className="px-4 py-3 rounded-2xl mb-4"
        style={{ backgroundColor: Colors.card, color: Colors.textPrimary, height: 100 }}
        placeholder="Write your thoughts..."
        placeholderTextColor={Colors.textSecondary}
        multiline
        value={entry}
        onChangeText={setEntry}
      />

      <TouchableOpacity
        className="px-6 py-3 rounded-2xl mb-6"
        style={{ backgroundColor: Colors.accent, alignSelf: 'flex-start' }}
        onPress={saveEntry}
      >
        <Text style={{ color: Colors.bgPrimary }}>Save Entry</Text>
      </TouchableOpacity>

      <ScrollView>
        {entries.map((e, i) => (
          <View
            key={i}
            style={{
              backgroundColor: Colors.card,
              padding: 12,
              borderRadius: 16,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: Colors.textPrimary }}>{e}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
