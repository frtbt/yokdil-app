import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
