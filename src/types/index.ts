/**
 * Type barrel — all domain types re-exported from a single entry point.
 * 163 consumers import from '../types' and need no changes.
 *
 * Dependency order (no circular imports):
 *   core → route → poi
 *             └───────────→ journal
 *             └──────────────────→ adventure
 *   core ──────────────────────────────────→ challenge
 */
export * from './core';
export * from './route';
export * from './poi';
export * from './journal';
export * from './adventure';
export * from './challenge';
