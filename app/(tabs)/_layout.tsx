import { Tabs, Redirect } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useTheme } from '../../store/useTheme';
import type { ComponentProps } from 'react';

type FeatherName = ComponentProps<typeof Feather>['name'];

interface TabIconProps {
  name: FeatherName;
  focused: boolean;
  color: string;
  primaryColor: string;
  primaryLightColor: string;
}

function TabIcon({ name, focused, color, primaryColor, primaryLightColor }: TabIconProps) {
  return (
    <View style={[
      styles.iconWrap,
      focused && { backgroundColor: primaryLightColor },
    ]}>
      <Feather name={name} size={22} color={focused ? primaryColor : color} />
    </View>
  );
}

export default function TabLayout() {
  const { colors: c } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const insets = useSafeAreaInsets();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  const tabIcon = (name: FeatherName) =>
    ({ focused, color }: { focused: boolean; color: string }) => (
      <TabIcon
        name={name}
        focused={focused}
        color={color}
        primaryColor={c.primary}
        primaryLightColor={c.primaryLight}
      />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.tabBar,
          borderTopColor: c.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 58 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? 28 : insets.bottom + 6,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textTertiary,
      }}
    >
      <Tabs.Screen name="index"      options={{ tabBarIcon: tabIcon('home')           }} />
      <Tabs.Screen name="categories" options={{ tabBarIcon: tabIcon('grid')           }} />
      <Tabs.Screen name="exams"      options={{ tabBarIcon: tabIcon('clipboard')      }} />
      <Tabs.Screen name="library"    options={{ tabBarIcon: tabIcon('download-cloud') }} />
      <Tabs.Screen name="profile"    options={{ tabBarIcon: tabIcon('user')           }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
