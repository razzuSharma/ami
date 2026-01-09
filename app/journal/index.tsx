import { AntDesign } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { FlatList, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function JournalScreen() {
  const [entries, setEntries] = useState([
    { id: '1', text: 'Feeling happy today! 🌞', date: '23 Dec 2025' },
    { id: '2', text: 'Had a nice walk in the evening.', date: '22 Dec 2025' },
  ]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEntry, setNewEntry] = useState('');

  const addEntry = () => {
    if (!newEntry.trim()) return;
    setEntries([{ id: Date.now().toString(), text: newEntry, date: new Date().toLocaleDateString() }, ...entries]);
    setNewEntry('');
    setModalVisible(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <LinearGradient colors={['#1f2937', '#111827']} className="flex-1 px-4 pt-4">
        <Text className="text-white text-2xl font-bold mb-4">My Journal</Text>

        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View className="bg-slate-800 rounded-2xl p-4 mb-4 shadow-md">
              <Text className="text-white text-base">{item.text}</Text>
              <Text className="text-gray-400 text-xs mt-2">{item.date}</Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />

        {/* Add Entry Button */}
        <TouchableOpacity
          className="absolute bottom-6 right-6 bg-blue-500 w-14 h-14 rounded-full justify-center items-center shadow-lg"
          onPress={() => setModalVisible(true)}
        >
          <AntDesign name="plus" size={24} color="white" />
        </TouchableOpacity>

        {/* Modal for new entry */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/50">
            <View className="bg-gray-800 rounded-2xl p-6 w-11/12">
              <Text className="text-white text-lg font-semibold mb-2">New Journal Entry</Text>
              <TextInput
                className="bg-gray-700 text-white rounded-2xl p-3 mb-4"
                placeholder="Write something..."
                placeholderTextColor="#9ca3af"
                value={newEntry}
                onChangeText={setNewEntry}
                multiline
              />
              <View className="flex-row justify-end space-x-3 gap-4">
                <TouchableOpacity className='bg-gray-700 rounded-2xl p-3' onPress={() => setModalVisible(false)}>
                  <Text className="text-white-400 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity className='bg-blue-500 rounded-2xl p-3' onPress={addEntry}>
                  <Text className="font-semibold">Add</Text>
                </TouchableOpacity>
s              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}
