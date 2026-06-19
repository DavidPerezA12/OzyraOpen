import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAppBootstrap } from './useAppBootstrap';

const ENABLED_MODEL_IDS_KEY = 'ozyra:enabled-model-ids:v2';

const storage = new Map<string, string>();

const setMockLocalStorage = () => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    },
  });
};

const BootstrapHarness = () => {
  const bootstrap = useAppBootstrap({
    updateUsageFromProfile: vi.fn(),
  });

  return (
    <>
      <output data-testid="enabled-model-ids">{JSON.stringify(bootstrap.enabledModelIds)}</output>
      <button type="button" onClick={() => bootstrap.setEnabledModelIds([])}>
        Quitar modelos
      </button>
    </>
  );
};

describe('useAppBootstrap model preferences', () => {
  beforeEach(() => {
    storage.clear();
    setMockLocalStorage();
  });

  it('treats an empty enabled-model list as an explicit saved preference', () => {
    storage.set(ENABLED_MODEL_IDS_KEY, '[]');

    render(<BootstrapHarness />);

    expect(screen.getByTestId('enabled-model-ids')).toHaveTextContent('[]');
  });

  it('persists an empty enabled-model list', () => {
    storage.set(ENABLED_MODEL_IDS_KEY, '["openai/gpt-5-chat"]');

    render(<BootstrapHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar modelos' }));

    expect(storage.get(ENABLED_MODEL_IDS_KEY)).toBe('[]');
    expect(screen.getByTestId('enabled-model-ids')).toHaveTextContent('[]');
  });
});
