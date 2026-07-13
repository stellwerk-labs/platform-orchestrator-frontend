import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from './useDebouncedValue';

vi.useFakeTimers();

describe('useDebouncedValue', () => {
  it('should return the initial value', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 200));
    expect(result.current).toBe('initial');
  });

  it('should update debounced value after delay', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: 'initial', delay: 200 },
    });

    expect(result.current).toBe('initial');

    act(() => {
      rerender({ value: 'updated', delay: 200 });
    });

    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('updated');
  });

  it('should clear timeout on unmount', () => {
    vi.spyOn(global, 'clearTimeout');
    const { unmount } = renderHook(() => useDebouncedValue('initial', 200));

    unmount();

    // Ensure that clearTimeout is called when the component unmounts
    expect(global.clearTimeout).toHaveBeenCalled();
  });
});
