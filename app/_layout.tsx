import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { AppBootstrap } from '@/components/AppBootstrap';

function RootNavigator() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="reminder/[id]" options={{ title: 'Edit Reminder' }} />
        <Stack.Screen name="search" options={{ title: 'Search' }} />
        <Stack.Screen name="all" options={{ title: 'All Reminders' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppBootstrap>
          <RootNavigator />
        </AppBootstrap>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
