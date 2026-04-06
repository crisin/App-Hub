import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to your new app</Text>
      <Text style={styles.subtitle}>Start building something great.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  title: { fontSize: 24, fontWeight: '700', color: '#e4e4ef', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#8888a0' },
});
