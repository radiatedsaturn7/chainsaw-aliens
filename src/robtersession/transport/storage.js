export const defaultProgress = () => ({ unlockedSets: 1, bestScores: {}, bestAccuracy: {}, bestGrades: {} });
export const loadProgress = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
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
export const saveProgress = (key, progress) => localStorage.setItem(key, JSON.stringify(progress));
