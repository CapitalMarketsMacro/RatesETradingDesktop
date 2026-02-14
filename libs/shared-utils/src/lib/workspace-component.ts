import { inject } from '@angular/core';
import { WorkspaceStorageService } from './workspace-storage.service';

/**
 * WorkspaceComponent
 *
 * Abstract base class for any Angular component that participates in
 * layout save / restore.  Subclasses implement:
 *
 *  - `getState()` — returns a JSON-serialisable object representing the
 *    component's current user-customisable state.
 *  - `setState(state)` — re-applies a previously saved state object.
 *
 * State persistence is handled by the injected `WorkspaceStorageService`,
 * NOT by accessing localStorage directly.  This makes the mechanism
 * testable, swappable, and centralised.
 *
 * ## Per-instance support
 *
 * Each view instance has a unique `instanceId`.  By default the ID is
 * read from the URL query parameter `viewId` (which is set by the host
 * page when adding a view).  If no `viewId` is present (e.g. default
 * layouts), `stateKey` is used as a fallback — meaning all instances of
 * that component type share one state entry (fine for settings-like
 * state such as column widths).
 *
 * ## Per-layout support
 *
 * Each saved layout bundles its own copy of the component states.  When
 * restoring, the bundled states are written into the storage service
 * *before* views are created, so `loadPersistedState()` picks up the
 * correct state for that specific layout.
 *
 * ## Usage
 *
 * ```ts
 * export class MyView extends WorkspaceComponent implements OnInit {
 *   readonly stateKey = 'my-view';
 *
 *   getState() { return { col: this.col }; }
 *   setState(s: Record<string, unknown>) { this.col = s['col'] as number; }
 *
 *   ngOnInit() {
 *     this.loadPersistedState();       // restore on init
 *   }
 *   onUserAction() {
 *     this.persistState();             // save after change
 *   }
 * }
 * ```
 */
export abstract class WorkspaceComponent {
  /**
   * Injected storage service.  Works because subclasses are Angular
   * `@Component` classes, so their constructor runs in an injection
   * context — field initialisers in the base class participate in that
   * context.
   */
  protected readonly storageService = inject(WorkspaceStorageService);

  /**
   * Component-type key (e.g. `market-data/top-of-book`).
   * Used as a fallback `instanceId` when no URL `viewId` is present.
   */
  abstract readonly stateKey: string;

  /**
   * Unique instance identifier.  Resolved lazily on first access:
   *
   *  1. URL query param `viewId` (set by the host when adding a view)
   *  2. Falls back to `stateKey` (shared across instances of the same type)
   *
   * Can be set explicitly before `loadPersistedState()` if needed.
   */
  get instanceId(): string {
    if (!this._instanceId) {
      const params = new URLSearchParams(window.location.search);
      this._instanceId = params.get('viewId') || this.stateKey;
    }
    return this._instanceId;
  }
  set instanceId(value: string) {
    this._instanceId = value;
  }
  private _instanceId?: string;

  // ── Abstract contract ──

  /** Return the component's current state as a JSON-serialisable object. */
  abstract getState(): Record<string, unknown>;

  /** Re-apply a previously saved state object. */
  abstract setState(state: Record<string, unknown>): void;

  // ── Persistence helpers ──

  /**
   * Persist the current state via the storage service.
   * Call after any user-initiated change worth preserving
   * (column resize, filter change, etc.).
   */
  persistState(): void {
    try {
      this.storageService.saveState(this.instanceId, this.getState());
    } catch {
      // silently ignore
    }
  }

  /**
   * Load and apply persisted state from the storage service.
   * Call early in `ngOnInit()` (after defaults are set).
   * Returns `true` if state was found and applied.
   */
  loadPersistedState(): boolean {
    try {
      const state = this.storageService.loadState(this.instanceId);
      if (state) {
        this.setState(state);
        return true;
      }
    } catch {
      // corrupted or missing — start fresh
    }
    return false;
  }
}
