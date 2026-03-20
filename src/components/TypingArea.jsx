import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import "./TypingArea.css";

export default function TypingArea({
  words,
  typedWords,
  currentInput,
  currentWordIndex,
  isRunning,
  isFinished,
  disabled,
  onInput,
  onGoToPrevWord,
  onClearCurrentWord,
}) {
  const inputRef = useRef(null);
  const wordsRef = useRef(null);
  const caretRef = useRef(null);
  const areaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(true);
  const scrollOffsetRef = useRef(0);
  const caretBlinkTimeout = useRef(null);
  const [caretBlink, setCaretBlink] = useState(true);

  // Focus input
  const focusInput = useCallback(() => {
    if (inputRef.current && !isFinished && !disabled) {
      inputRef.current.focus();
    }
  }, [isFinished, disabled]);

  // Auto focus on mount and when test resets
  useEffect(() => {
    if (disabled && inputRef.current) {
      inputRef.current.blur();
    } else {
      focusInput();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusInput, words.length, disabled]);

  // Click to focus
  const handleWrapperClick = useCallback(() => {
    focusInput();
  }, [focusInput]);

  // Redirect stray keypresses to input
  useEffect(() => {
    const handler = (e) => {
      if (isFinished) return;
      if (!isFocused && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        focusInput();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isFocused, isFinished, focusInput]);

  // Global click to focus (outside settings/header)
  useEffect(() => {
    const handler = (e) => {
      if (isFinished) return;
      const target = e.target;
      if (
        !target.closest(".settings") &&
        !target.closest(".theme-toggle") &&
        !target.closest(".results-container")
      ) {
        focusInput();
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [isFinished, focusInput]);

  // Handle input change
  const handleInputChange = useCallback(
    (e) => {
      // Prevent paste
      if (e.nativeEvent.inputType === "insertFromPaste") {
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      onInput(e.target.value);
    },
    [onInput]
  );

  // Handle keydown for backspace navigation and caret blink
  const handleKeyDown = useCallback(
    (e) => {
      // Caret blink management
      setCaretBlink(false);
      clearTimeout(caretBlinkTimeout.current);
      caretBlinkTimeout.current = setTimeout(() => setCaretBlink(true), 500);

      if (e.key === "Backspace" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onClearCurrentWord();
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      if (e.key === "Backspace" && currentInput === "" && currentWordIndex > 0) {
        e.preventDefault();
        const prevTyped = onGoToPrevWord();
        if (prevTyped !== null && inputRef.current) {
          inputRef.current.value = prevTyped;
        }
      }
    },
    [currentInput, currentWordIndex, onGoToPrevWord, onClearCurrentWord]
  );

  // Paste prevention
  const handlePaste = useCallback((e) => e.preventDefault(), []);

  // Reset scroll when words change (new test)
  useEffect(() => {
    scrollOffsetRef.current = 0;
    if (wordsRef.current) {
      wordsRef.current.style.transform = "translateY(0px)";
    }
  }, [words]);

  // Update caret position and scroll
  useEffect(() => {
    if (!wordsRef.current || !caretRef.current || !areaRef.current) return;

    const wordElements = wordsRef.current.querySelectorAll(".word");
    const currentWordEl = wordElements[currentWordIndex];
    if (!currentWordEl) return;

    const letters = currentWordEl.querySelectorAll(".letter");
    const typedLen = currentInput.length;

    // Use offsetTop/offsetLeft relative to .words container (unaffected by transforms)
    let rawLeft, rawTop;

    if (typedLen < letters.length) {
      const target = letters[typedLen];
      // For inline-block elements, offsetParent is .words (position:relative)
      // so offsetLeft/offsetTop are already relative to the .words container
      rawLeft = target.offsetLeft;
      rawTop = target.offsetTop;
    } else if (letters.length > 0) {
      const lastLetter = currentWordEl.querySelector(".letter:last-child");
      if (lastLetter) {
        rawLeft = lastLetter.offsetLeft + lastLetter.offsetWidth;
        rawTop = lastLetter.offsetTop;
      } else {
        return;
      }
    } else {
      return;
    }

    // Line scrolling: determine which line the caret is on
    const fontSize = parseFloat(getComputedStyle(areaRef.current).fontSize);
    const lineHeight = fontSize * 2.2;
    const targetLine = Math.floor(rawTop / lineHeight);

    if (targetLine > 0) {
      const newOffset = -(targetLine * lineHeight);
      if (newOffset !== scrollOffsetRef.current) {
        scrollOffsetRef.current = newOffset;
        wordsRef.current.style.transform = `translateY(${newOffset}px)`;
      }
    } else if (scrollOffsetRef.current !== 0) {
      scrollOffsetRef.current = 0;
      wordsRef.current.style.transform = "translateY(0px)";
    }

    // Position vertical line caret centered in the line
    const lineH = fontSize * 2.2;
    const caretTop = rawTop + lineH * 0.22;
    caretRef.current.style.left = `${rawLeft - 1}px`;
    caretRef.current.style.top = `${caretTop + scrollOffsetRef.current}px`;
  }, [currentInput, currentWordIndex, typedWords]);

  // Build word elements — memoize the visible window
  const visibleWords = useMemo(() => {
    // Render a window of words around current position for performance
    const start = 0;
    const end = Math.min(words.length, currentWordIndex + 100);
    return words.slice(start, end);
  }, [words, currentWordIndex]);

  return (
    <div className="typing-wrapper" onClick={handleWrapperClick}>
      <input
        ref={inputRef}
        type="text"
        className="hidden-input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={currentInput}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />

      <div
        ref={areaRef}
        className={`typing-area ${!isFocused && !isFinished ? "blurred" : ""}`}
      >
        <div
          ref={caretRef}
          className={`caret ${caretBlink ? "blink" : ""}`}
        />
        <div
          ref={wordsRef}
          className="words"
        >
          {visibleWords.map((word, wi) => {
            const typed = wi < currentWordIndex
              ? typedWords[wi] || ""
              : wi === currentWordIndex
              ? currentInput
              : "";
            const isCompleted = wi < currentWordIndex;

            return (
              <span key={wi} className="word" data-index={wi}>
                {word.split("").map((char, ci) => {
                  let className = "letter";
                  if (ci < typed.length) {
                    className += typed[ci] === char ? " correct" : " incorrect";
                  }
                  if (isCompleted && ci >= typed.length) {
                    className += " missed";
                  }
                  return (
                    <span key={ci} className={className}>
                      {char}
                    </span>
                  );
                })}
                {/* Extra typed characters beyond word length */}
                {typed.length > word.length &&
                  typed
                    .slice(word.length)
                    .split("")
                    .map((char, ci) => (
                      <span key={`extra-${ci}`} className="letter extra">
                        {char}
                      </span>
                    ))}
              </span>
            );
          })}
        </div>
      </div>

      {!isFocused && !isFinished && (
        <div className="focus-overlay visible">
          <span>click here or press any key to focus</span>
        </div>
      )}
    </div>
  );
}
