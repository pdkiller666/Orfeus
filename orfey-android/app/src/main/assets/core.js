(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OrfeyCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const finite = (value, fallback = 0) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const uniqueStrings = value => Array.isArray(value)
    ? [...new Set(value.filter(item => typeof item === "string").slice(-500))]
    : [];

  function yinPitch(buffer, sampleRate, minHz = 50, maxHz = 1000) {
    if (!buffer || buffer.length < 128 || !Number.isFinite(sampleRate) || sampleRate < 8000) return -1;
    const length = Math.floor(buffer.length / 2);
    const signal = new Float32Array(length);
    let mean = 0;
    for (let i = 0; i < length; i++) {
      signal[i] = buffer[i * 2];
      mean += signal[i];
    }
    mean /= length;
    let energy = 0;
    for (let i = 0; i < length; i++) {
      signal[i] -= mean;
      energy += signal[i] * signal[i];
    }
    if (energy / length < 1e-6) return -1;

    const rate = sampleRate / 2;
    const minTau = Math.max(2, Math.floor(rate / maxHz));
    const maxTau = Math.min(Math.floor(rate / minHz), length - 2);
    if (maxTau <= minTau) return -1;
    const normalized = new Float64Array(maxTau + 1);
    let cumulative = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      const limit = length - maxTau;
      for (let i = 0; i < limit; i++) {
        const delta = signal[i] - signal[i + tau];
        sum += delta * delta;
      }
      cumulative += sum;
      normalized[tau] = cumulative > 0 ? (sum * tau) / cumulative : 1;
    }

    const threshold = 0.16;
    let selected = -1;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (normalized[tau] < threshold) {
        while (tau + 1 <= maxTau && normalized[tau + 1] < normalized[tau]) tau++;
        selected = tau;
        break;
      }
    }
    if (selected < 0) {
      let best = 1;
      for (let tau = minTau; tau <= maxTau; tau++) {
        if (normalized[tau] < best) {
          best = normalized[tau];
          selected = tau;
        }
      }
      if (selected < 0 || best > 0.3) return -1;
    }

    const left = Math.max(minTau, selected - 1);
    const right = Math.min(maxTau, selected + 1);
    const a = normalized[left];
    const b = normalized[selected];
    const c = normalized[right];
    const denominator = a - 2 * b + c;
    const adjustment = denominator === 0 ? 0 : 0.5 * (a - c) / denominator;
    const period = selected + Math.max(-0.5, Math.min(0.5, adjustment));
    const frequency = rate / period;
    return frequency >= minHz && frequency <= maxHz ? frequency : -1;
  }

  function pitchCue(cents) {
    const value = finite(cents, 0);
    if (Math.abs(value) <= 30) return "В зоне";
    return value > 0 ? "чуть выше" : "чуть ниже";
  }

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function computeGain(score, previousBest, hasPreviousBest) {
    const current = clamp(Math.round(finite(score, 0)), 0, 100);
    if (!hasPreviousBest) return Math.round(current / 2) + 10;
    const previous = clamp(Math.round(finite(previousBest, 0)), 0, 100);
    return current > previous ? Math.round((current - previous) / 2) + 2 : 0;
  }

  const gameScaleSteps = Object.freeze([0, 2, 4, 5, 7, 9, 12]);

  function createGameTargets(lowMidi, highMidi, randomSource = Math.random, count = 10) {
    const low = clamp(Math.round(finite(lowMidi, 60)), 24, 108);
    const high = clamp(Math.round(finite(highMidi, low + 12)), low, 120);
    const steps = gameScaleSteps.filter(step => low + step <= high);
    const options = steps.length ? steps : [0];
    const length = clamp(Math.floor(finite(count, 10)), 0, 30);
    const random = typeof randomSource === "function" ? randomSource : Math.random;
    return Array.from({ length }, () => {
      let sample = 0;
      try { sample = random(); } catch (_) { sample = 0; }
      const index = Math.min(options.length - 1, Math.floor(clamp(finite(sample, 0), 0, 1) * options.length));
      return low + options[index];
    });
  }

  function gamePitchInGate(pitchMidi, targetMidi, toleranceCents = 50) {
    if (!Number.isFinite(pitchMidi) || !Number.isFinite(targetMidi)) return false;
    const tolerance = clamp(finite(toleranceCents, 50), 0, 200);
    return Math.abs(pitchMidi - targetMidi) * 100 <= tolerance;
  }

  function recordGameGate(raw, hit) {
    const previous = isRecord(raw) ? raw : {};
    const passed = clamp(Math.floor(finite(previous.passed, 0)), 0, 30);
    const hits = clamp(Math.floor(finite(previous.hits, 0)), 0, passed);
    const combo = clamp(Math.floor(finite(previous.combo, 0)), 0, passed);
    const bestCombo = clamp(Math.floor(finite(previous.bestCombo, 0)), combo, 30);
    const score = { passed: passed + 1, hits, combo, bestCombo };
    if (hit === true) {
      score.hits += 1;
      score.combo += 1;
      score.bestCombo = Math.max(score.bestCombo, score.combo);
    } else {
      score.combo = 0;
    }
    return score;
  }

  const lessonIdPattern = /^[a-z][a-z0-9_-]{0,31}$/i;
  const lessonExerciseIdPattern = /^[a-z0-9а-яё-]{1,80}$/iu;

  function lessonExerciseKey(lessonId, title) {
    if (typeof lessonId !== "string" || !lessonIdPattern.test(lessonId)) return "";
    if (typeof title !== "string") return "";
    return title.toLowerCase().trim()
      .replace(/[^a-z0-9а-яё]+/giu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
  }

  function lessonExerciseKeys(lessonId, titles) {
    if (typeof lessonId !== "string" || !lessonIdPattern.test(lessonId) || !Array.isArray(titles)) return [];
    const used = new Set();
    return titles.map((title, index) => {
      const base = lessonExerciseKey(lessonId, title) || `exercise-${index + 1}`;
      let key = base;
      let suffix = 2;
      while (used.has(key)) key = `${base}-${index + 1}-${suffix++}`;
      used.add(key);
      return key;
    });
  }

  function normalizeLessonExerciseProgress(raw) {
    if (!isRecord(raw)) return {};
    const result = {};
    for (const [lessonId, exercises] of Object.entries(raw).slice(-100)) {
      if (!lessonIdPattern.test(lessonId) || !isRecord(exercises)) continue;
      const completed = {};
      for (const [exerciseId, done] of Object.entries(exercises).slice(-100)) {
        if (lessonExerciseIdPattern.test(exerciseId) && done === true) completed[exerciseId] = true;
      }
      if (Object.keys(completed).length) result[lessonId] = completed;
    }
    return result;
  }

  function setLessonExerciseDone(raw, lessonId, exerciseId, done) {
    const progress = normalizeLessonExerciseProgress(raw);
    if (typeof lessonId !== "string" || !lessonIdPattern.test(lessonId)
      || typeof exerciseId !== "string" || !lessonExerciseIdPattern.test(exerciseId)) return progress;
    const exercises = { ...(progress[lessonId] || {}) };
    if (done === true) exercises[exerciseId] = true;
    else delete exercises[exerciseId];
    if (Object.keys(exercises).length) progress[lessonId] = exercises;
    else delete progress[lessonId];
    return progress;
  }

  function getLessonExerciseProgress(raw, lessonId, exerciseIds) {
    const progress = normalizeLessonExerciseProgress(raw);
    const ids = Array.isArray(exerciseIds)
      ? [...new Set(exerciseIds.filter(id => typeof id === "string" && lessonExerciseIdPattern.test(id)))]
      : [];
    const completed = ids.filter(id => progress[lessonId]?.[id] === true).length;
    return { completed, total: ids.length, percent: ids.length ? Math.round(completed * 100 / ids.length) : 0 };
  }

  function normalizeState(raw, defaults, maxHistory = 500) {
    const base = isRecord(defaults) ? defaults : {};
    const input = isRecord(raw) ? raw : {};
    const state = { ...base, ...input };

    state.streak = clamp(Math.floor(finite(state.streak, 0)), 0, 1000000);
    state.pts = clamp(Math.floor(finite(state.pts, 0)), 0, 1000000000);
    state.freeze = clamp(Math.floor(finite(state.freeze, 0)), 0, 2);
    state.best = isRecord(state.best)
      ? Object.fromEntries(Object.entries(state.best)
          .filter(([, value]) => Number.isFinite(value))
          .map(([key, value]) => [key, clamp(value, 0, 100)]))
      : {};
    state.hist = Array.isArray(state.hist)
      ? state.hist.filter(item => isRecord(item)
          && typeof item.d === "string"
          && typeof item.id === "string"
          && Number.isFinite(item.s))
        .slice(-maxHistory)
        .map(item => ({
          d: item.d,
          id: item.id,
          s: clamp(item.s, 0, 100),
          g: clamp(finite(item.g, 0), 0, 1000000)
        }))
      : [];
    state.badges = uniqueStrings(state.badges);
    state.dn = uniqueStrings(state.dn);
    state.lessonExercises = normalizeLessonExerciseProgress(state.lessonExercises);
    state.range = Array.isArray(state.range)
      && state.range.length === 2
      && state.range.every(Number.isFinite)
      && state.range[0] < state.range[1]
      ? state.range.map(value => clamp(value, 0, 127))
      : (base.range ?? null);
    state.seen = state.seen === true || state.seen === 1 ? 1 : 0;
    state.theme = ["", "dark", "light"].includes(state.theme) ? state.theme : "";
    state.record = state.record === true;
    state.quizRewarded = state.quizRewarded === true;
    state.blindRewarded = state.blindRewarded === true;
    state.last = typeof state.last === "string" && /^\d{4}-\d{2}-\d{2}$/.test(state.last)
      ? state.last : "";
    state.rem = typeof state.rem === "string" && /^\d{2}:\d{2}$/.test(state.rem)
      ? state.rem : "";
    return state;
  }

  return {
    yinPitch,
    pitchCue,
    localDateKey,
    computeGain,
    createGameTargets,
    gamePitchInGate,
    recordGameGate,
    lessonExerciseKey,
    lessonExerciseKeys,
    normalizeLessonExerciseProgress,
    setLessonExerciseDone,
    getLessonExerciseProgress,
    normalizeState
  };
});
