/**
 * Centralized printing utility for Tarazu Smart.
 * Triggers the browser's native print layout safely.
 * Returns true if successful, or false if blocked/failed (e.g. inside sandboxed iframe).
 */
export const triggerPrint = (): boolean => {
  if (typeof window !== 'undefined') {
    try {
      window.print();
      return true;
    } catch (error) {
      console.warn('Printing is blocked or failed (possibly due to sandbox constraints):', error);
      return false;
    }
  }
  return false;
};
