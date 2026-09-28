import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { radii } from '@/theme/tokens';

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const barWidth = Math.min(width - 48, 640);
  const leftOffset = Math.max(0, (width - barWidth) / 2);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: isWide
          ? {
              backgroundColor: colors.tabBar,
              borderTopColor: 'transparent',
              height: 70,
              paddingBottom: 10,
              paddingTop: 8,
              position: 'absolute' as const,
              left: leftOffset,
              width: barWidth,
              bottom: 16,
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 10,
            }
          : {
              backgroundColor: colors.tabBar,
              borderTopColor: colors.border,
              height: 70,
              paddingBottom: 10,
              paddingTop: 8,
            },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSoft,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sunny-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarButton: (props) => (
            <Pressable
              onPress={() => router.push('/add')}
              style={styles.addWrap}
              accessibilityRole="button"
              accessibilityLabel="Add reminder"
            >
              <View
                style={[
                  styles.addBtn,
                  {
                    backgroundColor: colors.primary,
                    shadowColor: isDark ? '#000' : colors.shadow,
                  },
                ]}
              >
                <Ionicons name="add" size={30} color="#fff" />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addWrap: {
    top: -18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
