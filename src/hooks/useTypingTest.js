import { useState, useCallback, useRef, useEffect } from "react";
import { generateWordList } from "../data/words";

const INITIAL_WORD_COUNT = 200;
const VALID_DURATIONS = [15, 30, 60, 120];
const VALID_WORD_COUNTS = [10, 25, 50, 100];

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem("klacks-settings")) || {};
    return {
      mode: raw.mode === "sentences" ? "sentences" : "words",
      testType: raw.testType === "wordcount" ? "wordcount" : "time",
      duration: VALID_DURATIONS.includes(raw.duration) ? raw.duration : 15,
      wordCountTarget: VALID_WORD_COUNTS.includes(raw.wordCountTarget)
        ? raw.wordCountTarget
        : 25,
      punctuation: !!raw.punctuation,
      numbers: !!raw.numbers,
    };
  } catch {
    return {
      mode: "words",
      testType: "time",
      duration: 15,
      wordCountTarget: 25,
      punctuation: false,
      numbers: false,
    };
  }
}

export function useTypingTest() {
  const initialRef = useRef(null);
  if (initialRef.current === null) initialRef.current = loadSettings();
  const init = initialRef.current;

  const [mode, setMode] = useState(init.mode);
  const [testType, setTestType] = useState(init.testType); // "time" | "wordcount"
  const [duration, setDuration] = useState(init.duration);
  const [wordCountTarget, setWordCountTarget] = useState(init.wordCountTarget);
  const [punctuation, setPunctuation] = useState(init.punctuation);
  const [numbers, setNumbers] = useState(init.numbers);
  const [words, setWords] = useState(() =>
    generateWordList(init.mode, INITIAL_WORD_COUNT, {
      punctuation: init.punctuation,
      numbers: init.numbers,
    })
  );
  const [typedWords, setTypedWords] = useState([]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(init.duration);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [wpmHistory, setWpmHistory] = useState([]);
  const [liveWpm, setLiveWpm] = useState(0);

  const [wordSpeeds, setWordSpeeds] = useState([]);

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const lastRecordedSecond = useRef(0);
  const lastCorrectRef = useRef(0);
  const errorsRef = useRef(0);
  const lastErrorsRef = useRef(0);
  const lastWordTimeRef = useRef(null);

  // Refs to track latest state without causing effect re-runs
  const wordsRef = useRef(words);
  const typedWordsRef = useRef(typedWords);
  const currentInputRef = useRef(currentInput);
  const currentWordIndexRef = useRef(currentWordIndex);
  const testTypeRef = useRef(testType);
  const wordCountTargetRef = useRef(wordCountTarget);
  const optionsRef = useRef({ punctuation, numbers });

  // Keep refs in sync
  wordsRef.current = words;
  typedWordsRef.current = typedWords;
  currentInputRef.current = currentInput;
  currentWordIndexRef.current = currentWordIndex;
  testTypeRef.current = testType;
  wordCountTargetRef.current = wordCountTarget;
  optionsRef.current = { punctuation, numbers };

  // Persist settings
  useEffect(() => {
    localStorage.setItem(
      "klacks-settings",
      JSON.stringify({ mode, testType, duration, wordCountTarget, punctuation, numbers })
    );
  }, [mode, testType, duration, wordCountTarget, punctuation, numbers]);

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

  // Count all typed chars (for raw wpm)
  const countTotalTypedChars = useCallback(() => {
    const tw = typedWordsRef.current;
    const ci = currentInputRef.current;
    let total = 0;
    for (let i = 0; i < tw.length; i++) {
      if (tw[i]) total += tw[i].length + 1; // +1 for space
    }
    total += ci.length;
    return total;
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

  // Timer tick effect
  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;

      // Live wpm (updated continuously after the first second)
      if (elapsed >= 1) {
        const correctChars = countCorrectChars();
        setLiveWpm(Math.round((correctChars / 5) / (elapsed / 60)));
      }

      const isTime = testTypeRef.current === "time";
      const currentSecond = Math.floor(elapsed);

      // Record one history point per completed second
      if (
        currentSecond > lastRecordedSecond.current &&
        (!isTime || currentSecond <= duration)
      ) {
        const correctChars = countCorrectChars();
        const totalChars = countTotalTypedChars();
        const span = currentSecond - lastRecordedSecond.current;
        const wpm = Math.round((correctChars / 5) / (elapsed / 60));
        const raw = Math.round((totalChars / 5) / (elapsed / 60));
        // Instantaneous speed over the last second(s): correct chars × 12 = wpm
        const burst = Math.max(
          0,
          Math.round(((correctChars - lastCorrectRef.current) * 12) / span)
        );
        const errors = errorsRef.current - lastErrorsRef.current;
        lastCorrectRef.current = correctChars;
        lastErrorsRef.current = errorsRef.current;
        lastRecordedSecond.current = currentSecond;
        setWpmHistory((prev) => [
          ...prev,
          { second: currentSecond, wpm, raw, burst, errors },
        ]);
      }

      if (isTime) {
        const remaining = Math.max(0, duration - currentSecond);
        setTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(timerRef.current);
          setIsRunning(false);
          setIsFinished(true);
        }
      } else {
        setElapsedTime(currentSecond);
      }
    }, 100);

    return () => clearInterval(timerRef.current);
  }, [isRunning, duration, countCorrectChars, countTotalTypedChars]);

  // Check word count completion
  const checkWordCountFinish = useCallback((completedIndex) => {
    if (testTypeRef.current === "wordcount" && completedIndex >= wordCountTargetRef.current) {
      clearInterval(timerRef.current);
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setElapsedTime(elapsed);
      setIsRunning(false);
      setIsFinished(true);
    }
  }, []);

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

          // Per-word speed (used by the live ruler in word-count tests)
          const now = Date.now();
          const since = lastWordTimeRef.current || startTimeRef.current || now;
          const dt = Math.max(now - since, 120);
          lastWordTimeRef.current = now;
          setWordSpeeds((prev) => {
            const next = [...prev];
            next[idx] = Math.round(((input.length + 1) / 5) / (dt / 60000));
            return next;
          });

          const newIndex = idx + 1;
          setCurrentWordIndex(newIndex);
          setCurrentInput("");

          // Check if word count target reached
          checkWordCountFinish(newIndex);

          if (newIndex >= wordsRef.current.length - 20) {
            setWords((prev) => [
              ...prev,
              ...generateWordList(mode, INITIAL_WORD_COUNT, optionsRef.current),
            ]);
          }
        }
        return;
      }

      // Count error keystrokes (new character that doesn't match)
      if (value.length > currentInputRef.current.length) {
        const expected = wordsRef.current[currentWordIndexRef.current]?.[value.length - 1];
        if (expected === undefined || value[value.length - 1] !== expected) {
          errorsRef.current++;
        }
      }

      setCurrentInput(value);
    },
    [isFinished, isRunning, startTimer, mode, checkWordCountFinish]
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

    // In word count mode, only count up to the target words
    const maxIndex = testTypeRef.current === "wordcount"
      ? Math.min(cwi, wordCountTargetRef.current)
      : cwi;

    for (let i = 0; i <= maxIndex && i < w.length; i++) {
      const word = w[i];
      const typed = i < maxIndex ? tw[i] : ci;
      if (!typed && i === maxIndex) continue;
      if (!typed) continue;

      const isCompleted = i < maxIndex;

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

    // Calculate actual time used
    const actualTime = testTypeRef.current === "wordcount"
      ? (startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0)
      : duration;
    const minutes = actualTime / 60;
    const wpm = minutes > 0 ? Math.round((correctChars / 5) / minutes) : 0;
    const rawWpm = minutes > 0 ? Math.round((totalTyped / 5) / minutes) : 0;
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
      timeTaken: Math.round(actualTime * 10) / 10,
    };
  }, [duration, wpmHistory]);

  // Full reset helper
  const fullReset = useCallback((newMode, newTestType, newDuration, newWordCountTarget, opts) => {
    clearInterval(timerRef.current);
    const options = opts || optionsRef.current;
    const newWords = generateWordList(newMode, INITIAL_WORD_COUNT, options);
    setWords(newWords);
    setTypedWords([]);
    setCurrentInput("");
    setCurrentWordIndex(0);
    setIsRunning(false);
    setIsFinished(false);
    setTimeLeft(newTestType === "time" ? newDuration : 0);
    setElapsedTime(0);
    setWpmHistory([]);
    setLiveWpm(0);
    setWordSpeeds([]);
    startTimeRef.current = null;
    lastRecordedSecond.current = 0;
    lastCorrectRef.current = 0;
    errorsRef.current = 0;
    lastErrorsRef.current = 0;
    lastWordTimeRef.current = null;
  }, []);

  // Reset
  const reset = useCallback(() => {
    fullReset(mode, testType, duration, wordCountTarget);
  }, [mode, testType, duration, wordCountTarget, fullReset]);

  // Change mode (words/sentences)
  const changeMode = useCallback(
    (newMode) => {
      setMode(newMode);
      fullReset(newMode, testType, duration, wordCountTarget);
    },
    [testType, duration, wordCountTarget, fullReset]
  );

  // Change duration (time mode)
  const changeDuration = useCallback(
    (newDuration) => {
      setTestType("time");
      setDuration(newDuration);
      fullReset(mode, "time", newDuration, wordCountTarget);
    },
    [mode, wordCountTarget, fullReset]
  );

  // Change word count target
  const changeWordCount = useCallback(
    (newCount) => {
      setTestType("wordcount");
      setWordCountTarget(newCount);
      fullReset(mode, "wordcount", duration, newCount);
    },
    [mode, duration, fullReset]
  );

  // Toggle punctuation (words mode)
  const togglePunctuation = useCallback(() => {
    const next = !punctuation;
    setPunctuation(next);
    fullReset(mode, testType, duration, wordCountTarget, { punctuation: next, numbers });
  }, [punctuation, numbers, mode, testType, duration, wordCountTarget, fullReset]);

  // Toggle numbers (words mode)
  const toggleNumbers = useCallback(() => {
    const next = !numbers;
    setNumbers(next);
    fullReset(mode, testType, duration, wordCountTarget, { punctuation, numbers: next });
  }, [punctuation, numbers, mode, testType, duration, wordCountTarget, fullReset]);

  return {
    mode,
    testType,
    duration,
    wordCountTarget,
    punctuation,
    numbers,
    liveWpm,
    wpmHistory,
    wordSpeeds,
    togglePunctuation,
    toggleNumbers,
    words,
    typedWords,
    currentInput,
    currentWordIndex,
    isRunning,
    isFinished,
    timeLeft,
    elapsedTime,
    handleInput,
    goToPrevWord,
    clearCurrentWord,
    reset,
    changeMode,
    changeDuration,
    changeWordCount,
    getResults,
  };
}
