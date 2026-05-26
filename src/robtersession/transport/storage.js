import { loadServerPreference, saveServerPreference } from '../../ui/serverPreferences.js';

export const defaultProgress = () => ({ unlockedSets: 1, bestScores: {}, bestAccuracy: {}, bestGrades: {} });
export const loadProgress = (key) => {
  try {
    const parsed = loadServerPreference(key, null);
    if (!parsed) return defaultProgress();
    return {
      unlockedSets: parsed.unlockedSets ?? 1,
      bestScores: parsed.bestScores ?? {},
      bestAccuracy: parsed.bestAccuracy ?? {},
      bestGrades: parsed.bestGrades ?? {}
    };
  } catch {
    return defaultProgress();
  }
};
export const saveProgress = (key, progress) => {
  void saveServerPreference(key, progress);
};
