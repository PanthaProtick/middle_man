import { useCallback, useLayoutEffect, useRef } from "react";

export interface ScrollRetentionResult<T extends HTMLElement> {
  viewportRef: React.RefObject<T | null>;
  handleScroll: () => void;
  resetScroll: () => void;
}

export function useScrollRetention<T extends HTMLElement = HTMLDivElement>(
  dependency: unknown,
  resetKey: string = "",
): ScrollRetentionResult<T> {
  const viewportRef = useRef<T | null>(null);
  const scrollPosRef = useRef<number>(0);

  const resetScroll = useCallback(() => {
    scrollPosRef.current = 0;
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (viewportRef.current) {
      scrollPosRef.current = viewportRef.current.scrollTop;
    }
  }, []);

  useLayoutEffect(() => {
    scrollPosRef.current = 0;
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
  }, [resetKey]);

  useLayoutEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = scrollPosRef.current;
    }
  }, [dependency]);

  return { viewportRef, handleScroll, resetScroll };
}
