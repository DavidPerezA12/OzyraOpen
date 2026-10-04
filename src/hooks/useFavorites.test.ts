import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useFavorites } from './useFavorites';
import { readLocalStorage, removeLocalStorage } from '../utils/browserStorage';

describe('useFavorites', () => {
  beforeEach(() => {
    removeLocalStorage('ozyra:favorite-chat-ids:v1');
  });

  it('empieza vacío y alterna favoritos persistiendo', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites.size).toBe(0);

    act(() => {
      result.current.toggleFavorite('chat-1');
    });
    expect(result.current.favorites.has('chat-1')).toBe(true);
    expect(readLocalStorage('ozyra:favorite-chat-ids:v1')).toContain('chat-1');

    act(() => {
      result.current.toggleFavorite('chat-1');
    });
    expect(result.current.favorites.has('chat-1')).toBe(false);
  });

  it('recupera los favoritos guardados al montar', () => {
    const first = renderHook(() => useFavorites());
    act(() => {
      first.result.current.toggleFavorite('chat-9');
    });
    first.unmount();

    const second = renderHook(() => useFavorites());
    expect(second.result.current.favorites.has('chat-9')).toBe(true);
  });
});
