import { useState, useCallback, useRef, useEffect } from "react";
import {
  wpmFrom,
  classifyInsert,
  countNetChars,
  charBreakdown,
  consistencyOf,
} from "../utils/scoring";

/**
 * A variant of useTypingTest designed for races.
 * Accepts an external word list and duration (from the race document).
 * Does NOT generate words or allow mode/duration changes.
 * Exposes live progress (currentWordIndex, live WPM) for reporting.
 *
 * Supports two test types:
 * - "time": countdown timer, test ends when time runs out
 * - "wordcount": count-up timer, test ends when enough words are typed
 *
 * Scoring matches solo tests (see utils/scoring.js).
 */
export function useRaceTypingTest(raceWords, raceDuration, raceTestType = "time", raceWordCount = 25) {
  const [words, setWords] = useState(raceWords || []);
  const [typedWords, setTypedWords] = useState([]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(raceDuration || 30);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [liveWpm, setLiveWpm] = useState(0);

  const startTimeRef = useRef(null); // performance.now()
  const endTimeRef = useRef(null);
  const finishedRef = useRef(false);
  const timerRef = useRef(null);
  const deadlineRef = useRef(null);
  const canTypeRef = useRef(false);
  const keysRef = useRef({ correct: 0, incorrect: 0 });
  const lastPointRef = useRef({ at: 0, second: 0, keys: 0 });
  const historyRef = useRef([]);

  const wordsRef = useRef(words);
  const typedWordsRef = useRef(typedWords);
  const currentInputRef = useRef(currentInput);
  const currentWordIndexRef = useRef(currentWordIndex);

  wordsRef.current = words;
  typedWordsRef.current = typedWords;
  currentInputRef.current = currentInput;
  currentWordIndexRef.current = currentWordIndex;

  const dur = raceDuration || 30;
  const isWordCount = raceTestType === "wordcount";
  const lastIndex = isWordCount ? raceWordCount - 1 : Infinity;

  // Sync words when race data arrives
  useEffect(() => {
    if (raceWords && raceWords.length > 0) {
      setWords(raceWords);
    }
  }, [raceWords]);

  useEffect(() => {
    if (raceDuration) setTimeLeft(raceDuration);
  }, [raceDuration]);

  const netChars = useCallback(
    () =>
      countNetChars(
        wordsRef.current,
        typedWordsRef.current,
        currentInputRef.current,
        currentWordIndexRef.current,
        lastIndex
      ),
    [lastIndex]
  );

  const recordPoint = useCallback(
    (elapsed, second) => {
      const last = lastPointRef.current;
      const span = elapsed - last.at;
      if (span <= 0) return;
      const keys = keysRef.current.correct + keysRef.current.incorrect;
      historyRef.current = [
        ...historyRef.current,
        {
          second,
          wpm: Math.floor(wpmFrom(netChars(), elapsed)),
          burst: Math.floor(wpmFrom(keys - last.keys, span)),
        },
      ];
      lastPointRef.current = { at: elapsed, second, keys };
    },
    [netChars]
  );

  const finish = useCallback(
    (endTime) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      canTypeRef.current = false;
      endTimeRef.current = endTime;
      clearInterval(timerRef.current);
      clearTimeout(deadlineRef.current);

      const elapsed = (endTime - startTimeRef.current) / 1000;
      if (!isWordCount) {
        if (lastPointRef.current.second < Math.floor(elapsed)) recordPoint(elapsed, Math.floor(elapsed));
      } else if (elapsed - lastPointRef.current.at >= 0.5) {
        recordPoint(elapsed, Math.round(elapsed * 10) / 10);
      }
      setElapsedTime(Math.round(elapsed * 10) / 10);
      setIsRunning(false);
      setIsFinished(true);
    },
    [isWordCount, recordPoint]
  );

  // Timer tick + exact deadline
  useEffect(() => {
    if (!isRunning) return;
    const deadline = startTimeRef.current + dur * 1000;

    timerRef.current = setInterval(() => {
      if (finishedRef.current) return;
      const now = performance.now();
      if (!isWordCount && now >= deadline) {
        finish(deadline);
        return;
      }
      const elapsed = (now - startTimeRef.current) / 1000;
      const second = Math.floor(elapsed);
      if (elapsed >= 1) setLiveWpm(Math.floor(wpmFrom(netChars(), elapsed)));
      if (second > lastPointRef.current.second) recordPoint(elapsed, second);

      if (isWordCount) {
        setElapsedTime(second);
        setTimeLeft(second); // display elapsed time
      } else {
        setTimeLeft(Math.max(0, dur - second));
      }
    }, 100);

    if (!isWordCount) {
      deadlineRef.current = setTimeout(() => finish(deadline), Math.max(0, deadline - performance.now()));
    }

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(deadlineRef.current);
    };
  }, [isRunning, dur, isWordCount, finish, netChars, recordPoint]);

  const handleInput = useCallback(
    (value) => {
      if (finishedRef.current || !canTypeRef.current) return;
      const now = performance.now();
      if (!isWordCount && now - startTimeRef.current >= dur * 1000) {
        finish(startTimeRef.current + dur * 1000);
        return;
      }

      const idx = currentWordIndexRef.current;
      const target = wordsRef.current[idx] || "";
      const prev = currentInputRef.current;
      const tally = (next) => {
        const { correct, incorrect } = classifyInsert(prev, next, target);
        keysRef.current.correct += correct;
        keysRef.current.incorrect += incorrect;
      };

      if (value.endsWith(" ")) {
        const word = value.slice(0, -1);
        if (word.length === 0) return;
        tally(word);
        if (word === target) keysRef.current.correct++;
        else keysRef.current.incorrect++;

        const typed = [...typedWordsRef.current];
        typed[idx] = word;
        typedWordsRef.current = typed;
        setTypedWords(typed);

        const nextIndex = idx + 1;
        currentWordIndexRef.current = nextIndex;
        currentInputRef.current = "";
        setCurrentWordIndex(nextIndex);
        setCurrentInput("");

        if (isWordCount && nextIndex >= raceWordCount) finish(now);
        return;
      }

      tally(value);

      // Word-count races end the moment the last word is typed correctly
      if (isWordCount && idx === raceWordCount - 1 && value === target) {
        const typed = [...typedWordsRef.current];
        typed[idx] = value;
        typedWordsRef.current = typed;
        currentWordIndexRef.current = idx + 1;
        currentInputRef.current = "";
        setTypedWords(typed);
        setCurrentWordIndex(idx + 1);
        setCurrentInput("");
        finish(now);
        return;
      }

      currentInputRef.current = value;
      setCurrentInput(value);
    },
    [isWordCount, dur, raceWordCount, finish]
  );

  const goToPrevWord = useCallback(() => {
    const idx = currentWordIndexRef.current;
    const input = currentInputRef.current;
    if (idx > 0 && input === "") {
      const prevIndex = idx - 1;
      const prevTyped = typedWordsRef.current[prevIndex] || "";
      currentWordIndexRef.current = prevIndex;
      currentInputRef.current = prevTyped;
      setCurrentWordIndex(prevIndex);
      setCurrentInput(prevTyped);
      return prevTyped;
    }
    return null;
  }, []);

  const clearCurrentWord = useCallback(() => {
    currentInputRef.current = "";
    setCurrentInput("");
  }, []);

  const getResults = useCallback(() => {
    const seconds = isWordCount
      ? ((endTimeRef.current ?? performance.now()) - startTimeRef.current) / 1000
      : dur;
    const args = [
      wordsRef.current,
      typedWordsRef.current,
      currentInputRef.current,
      currentWordIndexRef.current,
      lastIndex,
    ];
    const chars = charBreakdown(...args);
    const { correct, incorrect } = keysRef.current;
    const keys = correct + incorrect;
    const consistency = consistencyOf(historyRef.current.map((h) => h.burst));

    return {
      wpm: Math.floor(wpmFrom(countNetChars(...args), seconds)),
      rawWpm: Math.floor(wpmFrom(keys, seconds)),
      accuracy: keys > 0 ? Math.floor((correct / keys) * 100) : 0,
      consistency: consistency === null ? null : Math.floor(consistency),
      correctChars: chars.correct,
      incorrectChars: chars.incorrect,
      extraChars: chars.extra,
      missedChars: chars.missed,
      totalChars: chars.correct + chars.incorrect + chars.extra,
      wpmHistory: historyRef.current,
      wordsTyped: Math.min(currentWordIndexRef.current, isWordCount ? raceWordCount : Infinity),
      elapsedTime: Math.round(seconds * 10) / 10,
    };
  }, [isWordCount, dur, lastIndex, raceWordCount]);

  // Allow race to enable typing AND start the timer (after countdown)
  const enableTyping = useCallback(() => {
    canTypeRef.current = true;
    finishedRef.current = false;
    startTimeRef.current = performance.now();
    lastPointRef.current = { at: 0, second: 0, keys: 0 };
    setElapsedTime(0);
    setIsRunning(true);
  }, []);

  const reset = useCallback(() => {
    clearInterval(timerRef.current);
    clearTimeout(deadlineRef.current);
    setTypedWords([]);
    setCurrentInput("");
    setCurrentWordIndex(0);
    setIsRunning(false);
    setIsFinished(false);
    setTimeLeft(raceTestType === "wordcount" ? 0 : raceDuration || 30);
    setElapsedTime(0);
    setLiveWpm(0);
    typedWordsRef.current = [];
    currentInputRef.current = "";
    currentWordIndexRef.current = 0;
    startTimeRef.current = null;
    endTimeRef.current = null;
    finishedRef.current = false;
    canTypeRef.current = false;
    keysRef.current = { correct: 0, incorrect: 0 };
    lastPointRef.current = { at: 0, second: 0, keys: 0 };
    historyRef.current = [];
  }, [raceDuration, raceTestType]);

  // Keystroke accuracy so far
  const { correct, incorrect } = keysRef.current;
  const liveAccuracy = correct + incorrect > 0 ? Math.floor((correct / (correct + incorrect)) * 100) : 100;

  return {
    words,
    typedWords,
    currentInput,
    currentWordIndex,
    isRunning,
    isFinished,
    timeLeft,
    elapsedTime,
    liveWpm,
    liveAccuracy,
    handleInput,
    goToPrevWord,
    clearCurrentWord,
    getResults,
    enableTyping,
    reset,
  };
}
