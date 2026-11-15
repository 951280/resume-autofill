import type { ResumeProfile, Settings, StoredState } from './types.ts';
import { DEFAULT_SETTINGS, createDefaultProfile } from './defaultProfile.ts';

const KEY = 'ra.state.v1';

function mergeSettings(partial?: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...(partial || {}),
    llm: { ...DEFAULT_SETTINGS.llm, ...(partial?.llm || {}) },
  };
}

export async function loadState(): Promise<StoredState> {
  const got = await chrome.storage.local.get(KEY);
  const state = got?.[KEY] as StoredState | undefined;
  if (state && Array.isArray(state.profiles) && state.profiles.length > 0) {
    const active =
      state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
    return {
      profiles: state.profiles,
      activeProfileId: active.id,
      settings: mergeSettings(state.settings),
    };
  }
  return ensureState();
}

export async function ensureState(): Promise<StoredState> {
  const profile = createDefaultProfile();
  const state: StoredState = {
    profiles: [profile],
    activeProfileId: profile.id,
    settings: structuredClone(DEFAULT_SETTINGS),
  };
  await saveState(state);
  return state;
}

export async function saveState(state: StoredState): Promise<void> {
  await chrome.storage.local.set({ [KEY]: state });
}

export function activeProfile(state: StoredState): ResumeProfile {
  return (
    state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0]
  );
}

export function isHostDisabled(host: string, settings: Settings): boolean {
  return settings.disabledHosts.some((h) => host === h || host.endsWith(`.${h}`));
}
