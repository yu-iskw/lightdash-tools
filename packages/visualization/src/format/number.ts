/**
 * Locale-aware-ish number formatting (explicit locale only when provided).
 */

import { toDisplayString } from './escape';

import type { FieldFormat } from '../data/dataset';

function formatCompact(value: number, locale: string): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 1_000_000)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 1_000)}K`;
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

export function formatValue(value: unknown, format?: FieldFormat, locale = 'en-US'): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return toDisplayString(value);
  }

  const digits = format?.maximumFractionDigits ?? (Math.abs(value) >= 100 ? 1 : 2);

  if (format?.type === 'percent') {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: digits,
    }).format(value);
  }

  if (format?.type === 'currency') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: format.currency ?? 'USD',
      maximumFractionDigits: digits,
    }).format(value);
  }

  if (format?.type === 'number') {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  }

  return formatCompact(value, locale);
}
