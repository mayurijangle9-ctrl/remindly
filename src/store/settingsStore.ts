import { create } from 'zustand';
import { AppSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/constants/seed';
import * as repo from '@/db/repositories';

type SettingsState = {
  settings: AppSettings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  hydrated: false,
  hydrate: async () => {
    const map = await repo.getSettingsMap();
    set({
      hydrated: true,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(map as Partial<AppSettings>),
      },
    });
  },
  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await Promise.all(
      Object.entries(patch).map(([key, value]) => repo.setSetting(key, value))
    );
  },
}));
