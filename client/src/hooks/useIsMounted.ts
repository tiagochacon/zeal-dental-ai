import { useCallback, useEffect, useRef } from "react";

/**
 * Hook to track if a component is mounted.
 * Use this to guard async state updates and prevent
 * "Can't perform a React state update on an unmounted component" errors.
 * 
 * @returns A function that returns true if the component is still mounted
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => isMountedRef.current, []);
}

/**
 * Hook to create a safe setState wrapper that only updates state if mounted.
 * Prevents race conditions from async operations completing after unmount.
 * 
 * @param setState - The setState function to wrap
 * @returns A safe version of setState that checks mount status
 */
export function useSafeState<T>(
  setState: React.Dispatch<React.SetStateAction<T>>
): React.Dispatch<React.SetStateAction<T>> {
  const isMounted = useIsMounted();

  return useCallback(
    (value: React.SetStateAction<T>) => {
      if (isMounted()) {
        setState(value);
      }
    },
    [isMounted, setState]
  );
}
