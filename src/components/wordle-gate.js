/**
 * Wordle-style gate that protects site access.
 * Unlock persists in localStorage after a correct 5-letter guess.
 */
import {
  STORAGE_KEY_UNLOCKED,
  WORDLE_MAX_ATTEMPTS,
  WORDLE_WORD_LENGTH,
} from '../utils/constants.ts';

// Obfuscated target — validated via encoded char sequence, not plaintext
const TARGET = [72, 65, 66, 69, 82];

const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Back'],
];

/** Compare guess against obfuscated answer */
function isWinningGuess(guess) {
  if (guess.length !== WORDLE_WORD_LENGTH) return false;
  return guess.split('').every((char, index) => char.charCodeAt(0) === TARGET[index]);
}

/** Standard Wordle tile evaluation */
function evaluateGuess(guess, answerChars) {
  const result = Array(WORDLE_WORD_LENGTH).fill('absent');
  const answerCounts = {};

  answerChars.forEach((code) => {
    answerCounts[code] = (answerCounts[code] ?? 0) + 1;
  });

  // First pass: correct positions
  guess.split('').forEach((char, index) => {
    const code = char.charCodeAt(0);
    if (code === answerChars[index]) {
      result[index] = 'correct';
      answerCounts[code] -= 1;
    }
  });

  // Second pass: present letters
  guess.split('').forEach((char, index) => {
    if (result[index] === 'correct') return;
    const code = char.charCodeAt(0);
    if (answerCounts[code] > 0) {
      result[index] = 'present';
      answerCounts[code] -= 1;
    }
  });

  return result;
}

export function initWordleGate(root) {
  // Reveal page content (the no-flash guard hides it until we decide)
  function revealSite() {
    document.documentElement.classList.remove('gate-locked');
  }

  if (localStorage.getItem(STORAGE_KEY_UNLOCKED) === 'true') {
    revealSite();
    root.remove();
    return;
  }

  let currentGuess = '';
  let attempt = 0;
  const guesses = [];

  const overlay = document.createElement('div');
  overlay.className = 'wordle-overlay';

  overlay.innerHTML = `
    <div class="wordle-panel">
      <h1 class="wordle-title">A Wedding Wordle!</h1>
      <p class="wordle-subtitle">One of our favorite ways to spend time together after a long day of school was to solve the NYT's Wordle together so we've created our own version of it for you to solve. Guess the five-letter word to enter Caleb & Emma's wedding site.</p>
      <div class="wordle-board" aria-live="polite"></div>
      <p class="wordle-message" role="status"></p>
      <div class="wordle-keyboard"></div>
      <div class="wordle-actions"></div>
    </div>
  `;

  document.body.appendChild(overlay);
  root.remove();

  const boardEl = overlay.querySelector('.wordle-board');
  const messageEl = overlay.querySelector('.wordle-message');
  const keyboardEl = overlay.querySelector('.wordle-keyboard');
  const actionsEl = overlay.querySelector('.wordle-actions');

  /** Render empty and filled rows */
  function renderBoard() {
    boardEl.innerHTML = '';
    for (let row = 0; row < WORDLE_MAX_ATTEMPTS; row += 1) {
      const rowEl = document.createElement('div');
      rowEl.className = 'wordle-row';

      const letters = guesses[row]?.guess?.split('') ?? [];
      const evaluation = guesses[row]?.evaluation ?? [];

      for (let col = 0; col < WORDLE_WORD_LENGTH; col += 1) {
        const tile = document.createElement('div');
        tile.className = 'wordle-tile';
        if (letters[col]) tile.textContent = letters[col];
        if (row === attempt && !guesses[row]) {
          if (currentGuess[col]) tile.textContent = currentGuess[col];
          tile.classList.add('active');
        }
        if (evaluation[col]) tile.classList.add(evaluation[col]);
        rowEl.appendChild(tile);
      }

      boardEl.appendChild(rowEl);
    }
  }

  /** Update keyboard key colors from all guesses */
  function renderKeyboard() {
    const keyStates = {};
    guesses.forEach(({ guess, evaluation }) => {
      guess.split('').forEach((char, index) => {
        const state = evaluation[index];
        const prev = keyStates[char];
        if (state === 'correct' || (state === 'present' && prev !== 'correct')) {
          keyStates[char] = state;
        } else if (!prev) {
          keyStates[char] = state;
        }
      });
    });

    keyboardEl.innerHTML = '';
    KEY_ROWS.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'wordle-kb-row';
      row.forEach((key) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wordle-key';
        btn.textContent = key === 'Back' ? '⌫' : key;
        if (key.length > 1) btn.classList.add('wide');
        if (keyStates[key]) btn.classList.add(keyStates[key]);
        btn.addEventListener('click', () => handleKey(key));
        rowEl.appendChild(btn);
      });
      keyboardEl.appendChild(rowEl);
    });
  }

  /** Build an action button (Try again / Skip) */
  function buildActionButton(label, onClick, variant) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn ${variant} wordle-action`;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  /** Show Skip (after first guess) and Try Again (after a loss) */
  function updateActions() {
    actionsEl.innerHTML = '';
    const lost = attempt >= WORDLE_MAX_ATTEMPTS;

    if (lost) {
      actionsEl.appendChild(buildActionButton('Try again', resetPuzzle, 'btn-primary'));
    }

    if (guesses.length >= 1) {
      actionsEl.appendChild(buildActionButton('Skip puzzle', unlockSite, 'btn-secondary'));
    }
  }

  /** Clear all progress and start the puzzle over */
  function resetPuzzle() {
    currentGuess = '';
    attempt = 0;
    guesses.length = 0;
    messageEl.textContent = '';
    renderBoard();
    renderKeyboard();
    updateActions();
  }

  /** Unlock the site with a fade-out */
  function unlockSite() {
    messageEl.textContent = 'Welcome! Opening the site…';
    localStorage.setItem(STORAGE_KEY_UNLOCKED, 'true');
    revealSite();
    overlay.classList.add('wordle-overlay--hide');
    setTimeout(() => overlay.remove(), 400);
  }

  /** Submit the current row */
  function submitGuess() {
    if (currentGuess.length !== WORDLE_WORD_LENGTH) {
      messageEl.textContent = 'Need five letters.';
      return;
    }

    const evaluation = evaluateGuess(currentGuess.toUpperCase(), TARGET);
    guesses.push({ guess: currentGuess.toUpperCase(), evaluation });

    if (isWinningGuess(currentGuess.toUpperCase())) {
      renderBoard();
      renderKeyboard();
      unlockSite();
      return;
    }

    attempt += 1;
    currentGuess = '';

    if (attempt >= WORDLE_MAX_ATTEMPTS) {
      messageEl.textContent = 'Out of tries — give it another go!';
      renderBoard();
      renderKeyboard();
      updateActions();
      return;
    }

    messageEl.textContent = 'Not quite — keep guessing.';
    renderBoard();
    renderKeyboard();
    updateActions();
  }

  /** Handle physical or on-screen key press */
  function handleKey(key) {
    if (attempt >= WORDLE_MAX_ATTEMPTS) return;

    if (key === 'Enter') {
      submitGuess();
      return;
    }

    if (key === 'Back' || key === 'Backspace') {
      currentGuess = currentGuess.slice(0, -1);
      renderBoard();
      return;
    }

    if (/^[a-zA-Z]$/.test(key) && currentGuess.length < WORDLE_WORD_LENGTH) {
      currentGuess += key.toUpperCase();
      renderBoard();
    }
  }

  document.addEventListener('keydown', (event) => {
    if (overlay.parentElement) {
      handleKey(event.key === 'Backspace' ? 'Back' : event.key);
    }
  });

  renderBoard();
  renderKeyboard();
  updateActions();
}
