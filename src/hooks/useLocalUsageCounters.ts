import { useCallback, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { ModelTier } from '../types';
import { incrementMessageUsage } from '../utils/db';

// ============================================================================
// TYPES
// ============================================================================

interface LocalUsageCountersState {
  readonly messageUsage: number;
  readonly standardMessageUsage: number;
  readonly premiumMessageUsage: number;
  readonly lastMessageDate: string;
}

interface LocalUsageCountersActions {
  readonly incrementUsage: (modelTier: ModelTier, userId?: string | null) => Promise<void>;
  readonly resetCounters: () => void;
  readonly updateUsageFromProfile: (standard: number, premium: number) => void;
  readonly getUsageStats: () => { standard: number; premium: number; total: number };
}

type UseLocalUsageCountersReturn = LocalUsageCountersState & LocalUsageCountersActions;

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  STANDARD_USAGE: 'localStandardMessageUsage',
  PREMIUM_USAGE: 'localPremiumMessageUsage',
  TOTAL_USAGE: 'localMessageUsage',
  LAST_DATE: 'localMessageUsageDate',
} as const;

interface UsageSnapshot {
  standard: number;
  premium: number;
  total: number;
  date: string;
}

const readStoredCount = (key: string): number => {
  const parsed = Number.parseInt(localStorage.getItem(key) ?? '', 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getInitialUsageSnapshot = (): UsageSnapshot => {
  try {
    return {
      standard: readStoredCount(STORAGE_KEYS.STANDARD_USAGE),
      premium: readStoredCount(STORAGE_KEYS.PREMIUM_USAGE),
      total: readStoredCount(STORAGE_KEYS.TOTAL_USAGE),
      date: localStorage.getItem(STORAGE_KEYS.LAST_DATE) ?? '',
    };
  } catch {
    return { standard: 0, premium: 0, total: 0, date: '' };
  }
};

// ============================================================================
// HOOK
// ============================================================================

export const useLocalUsageCounters = (): UseLocalUsageCountersReturn => {
  const [usage, setUsage] = useState<UsageSnapshot>(getInitialUsageSnapshot);
  const usageSnapshotRef = useRef(usage);

  /**
   * Actualiza contadores locales informativos.
   * Actualiza primero el snapshot mutable para que dos incrementos seguidos
   * no lean ambos el mismo estado de React pendiente de commit.
   */
  const updateLocalCounters = useCallback((tier: ModelTier) => {
    const currentDate = new Date().toISOString().split('T')[0];
    const previous = usageSnapshotRef.current;
    const isNewDay = previous.date !== currentDate;
    const next = {
      standard: isNewDay ? 0 : previous.standard,
      premium: isNewDay ? 0 : previous.premium,
      total: isNewDay ? 0 : previous.total,
      date: currentDate,
    };

    if (tier === 'standard') {
      next.standard += 1;
    } else {
      next.premium += 1;
    }
    next.total += 1;

    usageSnapshotRef.current = next;
    setUsage(next);

    localStorage.setItem(STORAGE_KEYS.STANDARD_USAGE, next.standard.toString());
    localStorage.setItem(STORAGE_KEYS.PREMIUM_USAGE, next.premium.toString());
    localStorage.setItem(STORAGE_KEYS.TOTAL_USAGE, next.total.toString());
    localStorage.setItem(STORAGE_KEYS.LAST_DATE, next.date);
  }, []);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const incrementUsage = useCallback(
    async (modelTier: ModelTier, userId?: string | null) => {
      if (userId) {
        try {
          const updatedUsage = await incrementMessageUsage(userId, modelTier);
          if (updatedUsage) {
            usageSnapshotRef.current = {
              standard: updatedUsage.standard_message_usage,
              premium: updatedUsage.premium_message_usage,
              total: updatedUsage.standard_message_usage + updatedUsage.premium_message_usage,
              date: usageSnapshotRef.current.date,
            };
            setUsage(usageSnapshotRef.current);
          }
        } catch (error) {
          console.error('Error incrementing message usage:', error);
          toast.error('Error al actualizar el contador de mensajes');
        }
      } else {
        updateLocalCounters(modelTier);
      }
    },
    [updateLocalCounters]
  );

  const resetCounters = useCallback(() => {
    const todayIso = new Date().toISOString().split('T')[0];
    usageSnapshotRef.current = {
      standard: 0,
      premium: 0,
      total: 0,
      date: todayIso,
    };
    setUsage(usageSnapshotRef.current);
    localStorage.setItem(STORAGE_KEYS.STANDARD_USAGE, '0');
    localStorage.setItem(STORAGE_KEYS.PREMIUM_USAGE, '0');
    localStorage.setItem(STORAGE_KEYS.TOTAL_USAGE, '0');
    localStorage.setItem(STORAGE_KEYS.LAST_DATE, todayIso);
  }, []);

  const updateUsageFromProfile = useCallback((standard: number, premium: number) => {
    usageSnapshotRef.current = {
      standard,
      premium,
      total: standard + premium,
      date: usageSnapshotRef.current.date,
    };
    setUsage(usageSnapshotRef.current);
  }, []);

  const getUsageStats = useCallback(() => {
    return {
      standard: usage.standard,
      premium: usage.premium,
      total: usage.total,
    };
  }, [usage]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    messageUsage: usage.total,
    standardMessageUsage: usage.standard,
    premiumMessageUsage: usage.premium,
    lastMessageDate: usage.date,

    // Actions
    incrementUsage,
    resetCounters,
    updateUsageFromProfile,
    getUsageStats,
  };
};
