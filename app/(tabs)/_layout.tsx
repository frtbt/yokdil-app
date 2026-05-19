import { Tabs, Redirect } from 'expo-router';
import { useColorScheme, View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/Colors';
import type { ComponentProps } from 'react';

type FeatherName = ComponentProps<typeof Feather>['name'];

interface TabIconProps {
  name: FeatherName;
  focused: boolean;
  color: string;
}

function TabIcon({ name, focused, color }: TabIconProps) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Feather name={name} size={22} color={focused ? '#6C63FF' : color} />
    </View>
  );
}

export default function TabLayout() {
  const systemScheme = useColorScheme();
  const { isDarkMode } = useAppStore();
  const { isAuthenticated } = useAuthStore();
  const insets = useSafeAreaInsets();
  const dark = isDarkMode ?? systemScheme === 'dark';
  const c = dark ? Colors.dark : Colors.light;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

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
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: c.textTertiary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="grid" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="clipboard" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="download-cloud" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="user" focused={focused} color={color} />
          ),
        }}
      />
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
  iconWrapActive: {
    backgroundColor: '#EEF0FF',
  },
});
