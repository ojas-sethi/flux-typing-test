import { useState, useCallback, useRef, useEffect } from "react";
import { generateWordList } from "../data/words";

const INITIAL_WORD_COUNT = 200;

export function useTypingTest() {
  const [mode, setMode] = useState("words");
  const [duration, setDuration] = useState(60);
  const [words, setWords] = useState(() => generateWordList("words", INITIAL_WORD_COUNT));
  const [typedWords, setTypedWords] = useState([]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [wpmHistory, setWpmHistory] = useState([]);

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const lastRecordedSecond = useRef(0);

  // Refs to track latest state without causing effect re-runs
  const wordsRef = useRef(words);
  const typedWordsRef = useRef(typedWords);
  const currentInputRef = useRef(currentInput);
  const currentWordIndexRef = useRef(currentWordIndex);

  // Keep refs in sync
  wordsRef.current = words;
  typedWordsRef.current = typedWords;
  currentInputRef.current = currentInput;
  currentWordIndexRef.current = currentWordIndex;

  // Count correct chars (reads from refs, no dependencies that change)
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

  // Start timer
  const startTimer = useCallback(() => {
    setIsRunning((prev) => {
      if (prev) return prev; // already running
      startTimeRef.current = Date.now();
      lastRecordedSecond.current = 0;
      return true;
    });
  }, []);

  // Timer tick effect — only depends on isRunning and duration (both stable during a test)
  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, duration - Math.floor(elapsed));
      setTimeLeft(remaining);

      const currentSecond = Math.floor(elapsed);
      if (currentSecond > lastRecordedSecond.current && currentSecond <= duration) {
        const correctChars = countCorrectChars();
        const wpm = elapsed > 0 ? Math.round((correctChars / 5) / (elapsed / 60)) : 0;
        setWpmHistory((prev) => [...prev, { second: currentSecond, wpm }]);
        lastRecordedSecond.current = currentSecond;
      }

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        setIsRunning(false);
        setIsFinished(true);
      }
    }, 100);

    return () => clearInterval(timerRef.current);
  }, [isRunning, duration, countCorrectChars]);

  // Handle character input
  const handleInput = useCallback(
    (value) => {
      if (isFinished) return;

      if (!isRunning) {
        startTimer();
      }

      // Space pressed — move to next word
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

          if (idx + 1 >= wordsRef.current.length - 20) {
            setWords((prev) => [
              ...prev,
              ...generateWordList(mode, INITIAL_WORD_COUNT),
            ]);
          }
        }
        return;
      }

      setCurrentInput(value);
    },
    [isFinished, isRunning, startTimer, mode]
  );

  // Handle backspace to previous word
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

  // Clear current word (Ctrl+Backspace)
  const clearCurrentWord = useCallback(() => {
    setCurrentInput("");
  }, []);

  // Calculate final results
  const getResults = useCallback(() => {
    const tw = typedWordsRef.current;
    const w = wordsRef.current;
    const ci = currentInputRef.current;
    const cwi = currentWordIndexRef.current;

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
          if (typed[j] === word[j]) {
            correctChars++;
          } else {
            incorrectChars++;
          }
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

    const minutes = duration / 60;
    const wpm = Math.round((correctChars / 5) / minutes);
    const rawWpm = Math.round((totalTyped / 5) / minutes);
    const accuracy =
      totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 0;

    let consistency = 0;
    if (wpmHistory.length > 1) {
      const wpms = wpmHistory.map((h) => h.wpm);
      const mean = wpms.reduce((a, b) => a + b, 0) / wpms.length;
      const variance =
        wpms.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / wpms.length;
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
    };
  }, [duration, wpmHistory]);

  // Reset
  const reset = useCallback(() => {
    clearInterval(timerRef.current);
    const newWords = generateWordList(mode, INITIAL_WORD_COUNT);
    setWords(newWords);
    setTypedWords([]);
    setCurrentInput("");
    setCurrentWordIndex(0);
    setIsRunning(false);
    setIsFinished(false);
    setTimeLeft(duration);
    setWpmHistory([]);
    startTimeRef.current = null;
    lastRecordedSecond.current = 0;
  }, [mode, duration]);

  // Change mode
  const changeMode = useCallback(
    (newMode) => {
      setMode(newMode);
      clearInterval(timerRef.current);
      const newWords = generateWordList(newMode, INITIAL_WORD_COUNT);
      setWords(newWords);
      setTypedWords([]);
      setCurrentInput("");
      setCurrentWordIndex(0);
      setIsRunning(false);
      setIsFinished(false);
      setTimeLeft(duration);
      setWpmHistory([]);
      startTimeRef.current = null;
      lastRecordedSecond.current = 0;
    },
    [duration]
  );

  // Change duration
  const changeDuration = useCallback(
    (newDuration) => {
      setDuration(newDuration);
      clearInterval(timerRef.current);
      const newWords = generateWordList(mode, INITIAL_WORD_COUNT);
      setWords(newWords);
      setTypedWords([]);
      setCurrentInput("");
      setCurrentWordIndex(0);
      setIsRunning(false);
      setIsFinished(false);
      setTimeLeft(newDuration);
      setWpmHistory([]);
      startTimeRef.current = null;
      lastRecordedSecond.current = 0;
    },
    [mode]
  );

  return {
    mode,
    duration,
    words,
    typedWords,
    currentInput,
    currentWordIndex,
    isRunning,
    isFinished,
    timeLeft,
    handleInput,
    goToPrevWord,
    clearCurrentWord,
    reset,
    changeMode,
    changeDuration,
    getResults,
  };
}
