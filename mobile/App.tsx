import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { CompanionScreen } from './src/screens/CompanionScreen';
import { useLiveKitRoom } from './src/hooks/useLiveKitRoom';

export default function App() {
  const { room, disconnect } = useLiveKitRoom({
    userId: 'mobile_user_ios',
    autoConnect: false,
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <CompanionScreen
        room={room}
        user_id="mobile_user_ios"
        onDisconnect={disconnect}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d14',
  },
});

