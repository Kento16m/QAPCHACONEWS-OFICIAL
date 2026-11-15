// Robots open a note and leave without touching it; people stay and scroll, tap or move the mouse.
const INTERACTIONS = ["scroll", "pointerdown", "pointermove", "keydown", "touchstart"] as const;

/** Calls `onEngaged` once the tab was visible for `seconds` and the visitor interacted. Returns a cleanup. */
export function onceEngaged(onEngaged: () => void, seconds = 10): () => void {
  let visibleSeconds = 0;
  let interacted = false;

  const stop = () => {
    window.clearInterval(timer);
    INTERACTIONS.forEach((type) => window.removeEventListener(type, markInteracted));
  };
  const check = () => {
    if (visibleSeconds < seconds || !interacted) return;
    stop();
    onEngaged();
  };
  function markInteracted() {
    interacted = true;
    check();
  }

  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") visibleSeconds += 1;
    check();
  }, 1000);
  INTERACTIONS.forEach((type) => window.addEventListener(type, markInteracted, { passive: true }));
  return stop;
}
