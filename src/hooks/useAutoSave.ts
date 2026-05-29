import { useEffect, useRef } from 'react';

/**
 * A custom React hook that runs a callback function at a given interval,
 * keeping a stable reference to the callback to avoid interval resets.
 * 
 * @param callback The function to execute every delayMs
 * @param delayMs The time interval in milliseconds (default: 5000ms)
 */
export function useAutoSave(callback: () => void, delayMs: number = 5000) {
  const savedCallback = useRef(callback);

  // Remember the latest callback if it changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    const id = setInterval(() => {
      try {
        savedCallback.current();
      } catch (e) {
        console.error('AutoSave failed:', e);
      }
    }, delayMs);

    return () => clearInterval(id);
  }, [delayMs]);
}
