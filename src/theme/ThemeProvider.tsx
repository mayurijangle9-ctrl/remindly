import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, ThemeColors } from './tokens';
import { useSettingsStore } from '@/store/settingsStore';

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const themePref = useSettingsStore((s) => s.settings.theme);

  const value = useMemo(() => {
    const isDark =
      themePref === 'dark' || (themePref === 'system' && system === 'dark');
    return {
      isDark,
      colors: isDark ? darkColors : lightColors,
    };
  }, [system, themePref]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
