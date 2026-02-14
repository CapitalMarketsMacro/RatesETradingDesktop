import { Injectable, inject } from '@angular/core';
import { LoggerService } from '@rates-trading/logger';

/**
 * WorkspaceStorageService
 *
 * A generic, injectable service that manages workspace component state
 * persistence.  All state is scoped per-layout so that saving "Layout A"
 * and "Layout B" each bundle their own component states independently.
 *
 * ## Storage model
 *
 * ```
 * localStorage key                          value (JSON)
 * ─────────────────────────────────────     ──────────────────────────────
 * ws-component-states                       {
 *                                             "<instanceId>": { columnWidths: [...] },
 *                                             "<instanceId>": { ... },
 *                                           }
 * ```
 *
 * The "live" key holds the current working states.  When a layout is
 * **saved**, `collectAllStates()` snapshots the live map and bundles it
 * into the layout entry.  When a layout is **restored**, the bundled map
 * is written back to the live key via `restoreAllStates()` — so each
 * view picks up the correct state in its `ngOnInit()`.
 *
 * ## Multi-instance support
 *
 * Each view instance is identified by a unique `instanceId` (typically
 * the OpenFin view name, e.g. `top-of-book-1706123456789`).  The ID is
 * embedded in the view URL as `?viewId=<id>` so it survives layout
 * save/restore cycles (the URLs are part of the layout snapshot).
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceStorageService {
  private static readonly STORAGE_KEY = 'ws-component-states';

  private logger = inject(LoggerService).child({ service: 'WorkspaceStorage' });

  // ── Per-instance state ──

  /**
   * Save a component instance's state into the live map.
   *
   * @param instanceId  Unique ID for this view instance (from URL `viewId`
   *                    param, or the component's `stateKey` as fallback).
   * @param state       JSON-serialisable state object.
   */
  saveState(instanceId: string, state: Record<string, unknown>): void {
    try {
      const all = this.readLiveStates();
      all[instanceId] = state;
      this.writeLiveStates(all);
    } catch {
      // localStorage may be full or disabled — silently ignore
    }
  }

  /**
   * Load a component instance's state from the live map.
   * Returns `null` if no state is found.
   */
  loadState(instanceId: string): Record<string, unknown> | null {
    try {
      const all = this.readLiveStates();
      const state = all[instanceId];
      return (state && typeof state === 'object') ? state as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  /**
   * Remove a specific instance's state from the live map.
   */
  removeState(instanceId: string): void {
    try {
      const all = this.readLiveStates();
      delete all[instanceId];
      this.writeLiveStates(all);
    } catch {
      // ignore
    }
  }

  // ── Bulk operations for layout save / restore ──

  /**
   * Collect all live component states for bundling into a layout snapshot.
   * Returns a map of `instanceId → state`.
   */
  collectAllStates(): Record<string, unknown> {
    return this.readLiveStates();
  }

  /**
   * Replace the entire live state map with the states bundled from a
   * saved layout.  Called **before** views are loaded during restore.
   */
  restoreAllStates(states: Record<string, unknown>): void {
    this.writeLiveStates(states);
    this.logger.info(
      { count: Object.keys(states).length },
      'Component states restored from layout snapshot',
    );
  }

  /**
   * Clear all live component states.
   */
  clearAllStates(): void {
    try {
      localStorage.removeItem(WorkspaceStorageService.STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  // ── Internal helpers ──

  private readLiveStates(): Record<string, unknown> {
    try {
      const raw = localStorage.getItem(WorkspaceStorageService.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  private writeLiveStates(states: Record<string, unknown>): void {
    try {
      localStorage.setItem(
        WorkspaceStorageService.STORAGE_KEY,
        JSON.stringify(states),
      );
    } catch {
      // localStorage may be full
    }
  }
}
