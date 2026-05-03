import { useEffect, useRef, type RefObject } from "react";

/**
 * When active, focuses first focusable in container, traps Tab, restores focus on deactivate, calls onEscape on Escape.
 */
export function useFocusTrap(active: boolean, onEscape?: () => void): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const prev = document.activeElement as HTMLElement | null;

    const getFocusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const focusables = getFocusables();
    focusables[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;
      const list = getFocusables();
      if (list.length === 0) return;
      const cur = document.activeElement as HTMLElement | null;
      const ix = list.indexOf(cur as HTMLElement);
      if (e.shiftKey) {
        if (ix <= 0) {
          e.preventDefault();
          list[list.length - 1]?.focus();
        }
      } else if (ix === -1 || ix === list.length - 1) {
        e.preventDefault();
        list[0]?.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [active, onEscape]);
  return ref;
}
