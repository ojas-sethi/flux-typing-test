import { useState, useCallback, useRef, useEffect } from "react";

/**
 * A variant of useTypingTest designed for races.
 * Accepts an external word list and duration (from the race document).
 * Does NOT generate words or allow mode/duration changes.
 * Exposes live progress (currentWordIndex, live WPM) for reporting.
 *
 * Supports two test types:
 * - "time": countdown timer, test ends when time runs out
 * - "wordcount": count-up timer, test ends when enough words are typed
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
  const [wpmHistory, setWpmHistory] = useState([]);
  const [liveWpm, setLiveWpm] = useState(0);

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const lastRecordedSecond = useRef(0);
  const canTypeRef = useRef(false);

  // Refs for latest state
  const wordsRef = useRef(words);
  const typedWordsRef = useRef(typedWords);
  const currentInputRef = useRef(currentInput);
  const currentWordIndexRef = useRef(currentWordIndex);

  wordsRef.current = words;
  typedWordsRef.current = typedWords;
  currentInputRef.current = currentInput;
  currentWordIndexRef.current = currentWordIndex;

  // Sync words when race data arrives
  useEffect(() => {
    if (raceWords && raceWords.length > 0) {
      setWords(raceWords);
    }
  }, [raceWords]);

  useEffect(() => {
    if (raceDuration) setTimeLeft(raceDuration);
  }, [raceDuration]);

  const countCorrectChars = useCallback(() => {
    const tw = typedWordsRef.current;
    const w = wordsRef.current;
    const ci = currentInputRef.current;
    const cwi = currentWordIndexRef.current;

    let correct = 0;
    for (let i = 0; i < tw.length; i++) {
      const word = w[i];
      const typed = tw[i];
      if (!word || !typed) continue;
      for (let j = 0; j < word.length && j < typed.length; j++) {
        if (typed[j] === word[j]) correct++;
      }
      correct++; // space
    }
    const currentWord = w[cwi];
    if (currentWord && ci) {
      for (let j = 0; j < currentWord.length && j < ci.length; j++) {
        if (ci[j] === currentWord[j]) correct++;
      }
    }
    return correct;
  }, []);

  const startTimer = useCallback(() => {
    setIsRunning((prev) => {
      if (prev) return prev;
      startTimeRef.current = Date.now();
      lastRecordedSecond.current = 0;
      canTypeRef.current = true;
      return true;
    });
  }, []);

  // Timer tick
  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;

      if (raceTestType === "wordcount") {
        // Count up mode
        setElapsedTime(Math.floor(elapsed));
        setTimeLeft(Math.floor(elapsed)); // display elapsed time
      } else {
        // Count down mode
        const dur = raceDuration || 30;
        const remaining = Math.max(0, dur - Math.floor(elapsed));
        setTimeLeft(remaining);
      }

      const currentSecond = Math.floor(elapsed);
      const maxSecond = raceTestType === "wordcount" ? Infinity : (raceDuration || 30);
      if (currentSecond > lastRecordedSecond.current && currentSecond <= maxSecond) {
        const correctChars = countCorrectChars();
        const wpm = elapsed > 0 ? Math.round((correctChars / 5) / (elapsed / 60)) : 0;
        setWpmHistory((prev) => [...prev, { second: currentSecond, wpm }]);
        setLiveWpm(wpm);
        lastRecordedSecond.current = currentSecond;
      }

      // Time mode: end when time runs out
      if (raceTestType !== "wordcount") {
        const dur = raceDuration || 30;
        const remaining = Math.max(0, dur - Math.floor(elapsed));
        if (remaining <= 0) {
          clearInterval(timerRef.current);
          canTypeRef.current = false;
          setIsRunning(false);
          setIsFinished(true);
        }
      }
    }, 100);

    return () => clearInterval(timerRef.current);
  }, [isRunning, raceDuration, raceTestType, countCorrectChars]);

  // Word count mode: check if we've typed enough words
  useEffect(() => {
    if (raceTestType === "wordcount" && isRunning && currentWordIndex >= raceWordCount) {
      clearInterval(timerRef.current);
      canTypeRef.current = false;
      setIsRunning(false);
      setIsFinished(true);
      // Capture final elapsed time
      if (startTimeRef.current) {
        setElapsedTime(Math.round((Date.now() - startTimeRef.current) / 1000 * 10) / 10);
      }
    }
  }, [currentWordIndex, raceTestType, raceWordCount, isRunning]);

  const handleInput = useCallback(
    (value) => {
      if (isFinished || !canTypeRef.current || !isRunning) return;

      if (value.endsWith(" ")) {
        const input = currentInputRef.current;
        if (input.length > 0) {
          const idx = currentWordIndexRef.current;
          setTypedWords((prev) => {
            const next = [...prev];
            next[idx] = input;
            return next;
          });
          setCurrentWordIndex((prev) => prev + 1);
          setCurrentInput("");
        }
        return;
      }

      setCurrentInput(value);
    },
    [isFinished, isRunning]
  );

  const goToPrevWord = useCallback(() => {
    const idx = currentWordIndexRef.current;
    const input = currentInputRef.current;
    if (idx > 0 && input === "") {
      const prevIndex = idx - 1;
      const prevTyped = typedWordsRef.current[prevIndex] || "";
      setCurrentWordIndex(prevIndex);
      setCurrentInput(prevTyped);
      return prevTyped;
    }
    return null;
  }, []);

  const clearCurrentWord = useCallback(() => {
    setCurrentInput("");
  }, []);

  const getResults = useCallback(() => {
    const tw = typedWordsRef.current;
    const w = wordsRef.current;
    const ci = currentInputRef.current;
    const cwi = currentWordIndexRef.current;

    // For word count mode, use actual elapsed time; for time mode, use duration
    let dur;
    if (raceTestType === "wordcount") {
      dur = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 1;
    } else {
      dur = raceDuration || 30;
    }

    let correctChars = 0;
    let incorrectChars = 0;
    let extraChars = 0;
    let missedChars = 0;
    let totalTyped = 0;

    for (let i = 0; i <= cwi && i < w.length; i++) {
      const word = w[i];
      const typed = i < cwi ? tw[i] : ci;
      if (!typed && i === cwi) continue;
      if (!typed) continue;

      const isCompleted = i < cwi;

      for (let j = 0; j < word.length; j++) {
        if (j < typed.length) {
          totalTyped++;
          if (typed[j] === word[j]) correctChars++;
          else incorrectChars++;
        } else if (isCompleted) {
          missedChars++;
        }
      }

      if (typed.length > word.length) {
        const ex = typed.length - word.length;
        extraChars += ex;
        totalTyped += ex;
      }

      if (isCompleted) {
        correctChars++;
        totalTyped++;
      }
    }

    const minutes = dur / 60;
    const wpm = Math.round((correctChars / 5) / minutes);
    const rawWpm = Math.round((totalTyped / 5) / minutes);
    const accuracy = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 0;

    let consistency = 0;
    if (wpmHistory.length > 1) {
      const wpms = wpmHistory.map((h) => h.wpm);
      const mean = wpms.reduce((a, b) => a + b, 0) / wpms.length;
      const variance = wpms.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / wpms.length;
      const stdDev = Math.sqrt(variance);
      const cv = mean > 0 ? (stdDev / mean) * 100 : 100;
      consistency = Math.max(0, Math.round(100 - cv));
    }

    return {
      wpm,
      rawWpm,
      accuracy,
      consistency,
      correctChars,
      incorrectChars,
      extraChars,
      missedChars,
      totalChars: correctChars + incorrectChars + extraChars,
      wpmHistory,
      wordsTyped: cwi,
      elapsedTime: Math.round(dur * 10) / 10,
    };
  }, [raceDuration, raceTestType, wpmHistory]);

  // Allow race to enable typing AND start the timer (after countdown)
  const enableTyping = useCallback(() => {
    canTypeRef.current = true;
    startTimeRef.current = Date.now();
    lastRecordedSecond.current = 0;
    setElapsedTime(0);
    setIsRunning(true);
  }, []);

  const reset = useCallback(() => {
    clearInterval(timerRef.current);
    setTypedWords([]);
    setCurrentInput("");
    setCurrentWordIndex(0);
    setIsRunning(false);
    setIsFinished(false);
    setTimeLeft(raceTestType === "wordcount" ? 0 : (raceDuration || 30));
    setElapsedTime(0);
    setWpmHistory([]);
    setLiveWpm(0);
    startTimeRef.current = null;
    lastRecordedSecond.current = 0;
    canTypeRef.current = false;
  }, [raceDuration, raceTestType]);

  // Compute live accuracy
  const correctChars = countCorrectChars();
  const totalCharsTyped = typedWords.reduce((s, w) => s + (w ? w.length + 1 : 0), 0) + currentInput.length;
  const liveAccuracy = totalCharsTyped > 0 ? Math.round((correctChars / totalCharsTyped) * 100) : 100;

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
