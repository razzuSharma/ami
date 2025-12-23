// ChatBubble.tsx
import { Text, View } from 'react-native';

export default function ChatBubble({ message }: { message: { text: string, user: string; timestamp?: string } }) {
  const isUser = message.user === 'user';
  const time = message.timestamp ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View className={`my-1 px-4 py-2 max-w-[75%] ${isUser ? 'self-end bg-blue-500' : 'self-start bg-slate-700/70'} rounded-2xl shadow-md`}>
      <Text className={`${isUser ? 'text-white' : 'text-slate-50'} text-base`}>{message.text}</Text>
      <Text className="text-slate-400 text-xs mt-1 self-end">{time}</Text>
    </View>
  );
}
