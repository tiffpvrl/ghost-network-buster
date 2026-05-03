/**
 * Web Audio API synthesis for demo replay sound effects.
 * No files, no dependencies — all tones generated at runtime.
 */

const SOUND_KEY = "gnb_sound_enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(SOUND_KEY);
  if (v === null) {
    return !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }
  return v === "1";
}

export function setSoundEnabled(on: boolean): void {
  localStorage.setItem(SOUND_KEY, on ? "1" : "0");
}

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx) _ctx = new window.AudioContext();
  // Resume if browser suspended it (autoplay policy)
  if (_ctx.state === "suspended") void _ctx.resume();
  return _ctx;
}

/** Schedule a single oscillator burst with linear fade in/out. */
function osc(
  ac: AudioContext,
  type: OscillatorType,
  freq: number,
  startAt: number,
  endAt: number,
  gain = 0.25,
): void {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(gain, startAt + 0.01);
  g.gain.setValueAtTime(gain, endAt - 0.04);
  g.gain.linearRampToValueAtTime(0, endAt);
  o.connect(g);
  g.connect(ac.destination);
  o.start(startAt);
  o.stop(endAt + 0.05);
}

/**
 * Play the full sound sequence for one call result:
 *   1. Short phone ring pulse (always)
 *   2. Result tone 200ms later:
 *      - disconnected → SIT tri-tone (the real "disconnected" signal: 985→1428→1777 Hz)
 *      - other ghost  → low ominous sawtooth buzz
 *      - real         → warm ascending two-note chime
 *      - voicemail    → just the ring
 */
export function playCallSound(
  status: string,
  ghostReason?: string | null,
): void {
  if (!isSoundEnabled()) return;
  const ac = getCtx();
  const t = ac.currentTime;

  // Ring: a single short pulse with slight harmonic
  osc(ac, "sine", 440, t, t + 0.14, 0.18);
  osc(ac, "sine", 480, t, t + 0.14, 0.09);

  const r = t + 0.2; // result tone starts after ring fades

  if (status === "ghost") {
    if (ghostReason === "disconnected") {
      // ITU SIT (Special Information Tone) — immediately recognisable as "this number is dead"
      osc(ac, "sine", 985.2,  r,        r + 0.28, 0.28);
      osc(ac, "sine", 1428.5, r + 0.28, r + 0.56, 0.28);
      osc(ac, "sine", 1776.7, r + 0.56, r + 0.84, 0.28);
    } else {
      // Ominous low buzz for all other ghost types
      osc(ac, "sawtooth", 160, r,        r + 0.32, 0.15);
      osc(ac, "sawtooth", 120, r + 0.05, r + 0.32, 0.10);
    }
  } else if (status === "real") {
    // Warm ascending chime — relief after the ghosts
    osc(ac, "sine", 523.25, r,        r + 0.22, 0.25); // C5
    osc(ac, "sine", 783.99, r + 0.16, r + 0.42, 0.25); // G5
  }
  // voicemail / other: ring only, no result tone
}

/**
 * Short triumphant C-E-G-C arpeggio played when the audit completes.
 */
export function playComplete(): void {
  if (!isSoundEnabled()) return;
  const ac = getCtx();
  const t = ac.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    osc(ac, "sine", freq, t + i * 0.13, t + i * 0.13 + 0.22, 0.22);
  });
}
