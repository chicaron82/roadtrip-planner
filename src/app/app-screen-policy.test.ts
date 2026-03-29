import { describe, it, expect } from 'vitest';
import {
  getActiveSurface,
  getOverlayState,
  getUIFlags,
  type ScreenPolicyState,
} from './app-screen-policy';

// ── Helpers ───────────────────────────────────────────────────────────────

const base: ScreenPolicyState = {
  showVoila: false,
  pendingTemplate: false,
  showJournalAtAGlance: false,
  showPostTrip: false,
  tripMode: null,
  arcActive: false,
  showShareScreen: false,
  showAdventureMode: false,
  planningStep: 1,
  tripConfirmed: false,
  hasSummary: false,
};

function state(overrides: Partial<ScreenPolicyState>): ScreenPolicyState {
  return { ...base, ...overrides };
}

// ── getActiveSurface ──────────────────────────────────────────────────────

describe('getActiveSurface', () => {
  it('returns landing as default', () => {
    expect(getActiveSurface(base)).toBe('landing');
  });

  it('returns voila when showVoila is true and hasSummary', () => {
    expect(getActiveSurface(state({ showVoila: true, hasSummary: true }))).toBe('voila');
  });

  it('showVoila without hasSummary falls through to landing', () => {
    expect(getActiveSurface(state({ showVoila: true }))).toBe('landing');
  });

  it('voila wins over everything (when hasSummary)', () => {
    expect(getActiveSurface(state({
      showVoila: true,
      hasSummary: true,
      pendingTemplate: true,
      showJournalAtAGlance: true,
      tripMode: 'plan',
      arcActive: true,
    }))).toBe('voila');
  });

  it('returns templatePreview when pendingTemplate and not showVoila', () => {
    expect(getActiveSurface(state({ pendingTemplate: true }))).toBe('templatePreview');
  });

  it('returns journalAtAGlance when active', () => {
    expect(getActiveSurface(state({
      showJournalAtAGlance: true,
      tripMode: 'plan',
    }))).toBe('journalAtAGlance');
  });

  it('returns planning when tripMode is set', () => {
    expect(getActiveSurface(state({ tripMode: 'plan' }))).toBe('planning');
  });

  it('returns icebreaker when arcActive and no tripMode', () => {
    expect(getActiveSurface(state({ arcActive: true }))).toBe('icebreaker');
  });

  it('planning wins over icebreaker', () => {
    expect(getActiveSurface(state({
      tripMode: 'plan',
      arcActive: true,
    }))).toBe('planning');
  });

  it('icebreaker suppresses landing', () => {
    expect(getActiveSurface(state({ arcActive: true }))).not.toBe('landing');
  });
});

// ── getOverlayState ───────────────────────────────────────────────────────

describe('getOverlayState', () => {
  it('returns all false by default', () => {
    expect(getOverlayState(base)).toEqual({
      shareScreen: false,
      adventureMode: false,
      icebreakerOverlays: false,
      sessionRestoreMask: false,
    });
  });

  it('reflects shareScreen', () => {
    expect(getOverlayState(state({ showShareScreen: true })).shareScreen).toBe(true);
  });

  it('reflects adventureMode', () => {
    expect(getOverlayState(state({ showAdventureMode: true })).adventureMode).toBe(true);
  });

  it('reflects arcActive as icebreakerOverlays', () => {
    expect(getOverlayState(state({ arcActive: true })).icebreakerOverlays).toBe(true);
  });
});

// ── getUIFlags ────────────────────────────────────────────────────────────

describe('getUIFlags', () => {
  describe('shouldMountPlannerShell', () => {
    it('mounts shell during planning', () => {
      expect(getUIFlags(state({ tripMode: 'plan' })).shouldMountPlannerShell).toBe(true);
    });

    it('mounts shell during journalAtAGlance (Z2: ghost car state)', () => {
      expect(getUIFlags(state({
        tripMode: 'plan',
        showJournalAtAGlance: true,
        tripConfirmed: true,
      })).shouldMountPlannerShell).toBe(true);
    });

    it('does not mount shell on landing', () => {
      expect(getUIFlags(base).shouldMountPlannerShell).toBe(false);
    });

    it('does not mount shell on voila', () => {
      expect(getUIFlags(state({ showVoila: true })).shouldMountPlannerShell).toBe(false);
    });

    it('does not mount shell during icebreaker', () => {
      expect(getUIFlags(state({ arcActive: true })).shouldMountPlannerShell).toBe(false);
    });
  });

  describe('shouldDimBackground', () => {
    it('dims during planning', () => {
      expect(getUIFlags(state({ tripMode: 'plan' })).shouldDimBackground).toBe(true);
    });

    it('does not dim during journal (shell mounts but no wash)', () => {
      expect(getUIFlags(state({
        tripMode: 'plan',
        showJournalAtAGlance: true,
        tripConfirmed: true,
      })).shouldDimBackground).toBe(false);
    });

    it('does not dim on landing', () => {
      expect(getUIFlags(base).shouldDimBackground).toBe(false);
    });
  });

  describe('shouldShowRouteStrategy', () => {
    it('shows at step 3 with summary during planning', () => {
      expect(getUIFlags(state({
        tripMode: 'plan',
        planningStep: 3,
        hasSummary: true,
      })).shouldShowRouteStrategy).toBe(true);
    });

    it('hides at step 2', () => {
      expect(getUIFlags(state({
        tripMode: 'plan',
        planningStep: 2,
        hasSummary: true,
      })).shouldShowRouteStrategy).toBe(false);
    });

    it('hides without summary', () => {
      expect(getUIFlags(state({
        tripMode: 'plan',
        planningStep: 3,
        hasSummary: false,
      })).shouldShowRouteStrategy).toBe(false);
    });
  });

  describe('ghostCarActive', () => {
    it('active when confirmed + step 3 + summary', () => {
      expect(getUIFlags(state({
        tripMode: 'plan',
        tripConfirmed: true,
        planningStep: 3,
        hasSummary: true,
      })).ghostCarActive).toBe(true);
    });

    it('inactive without confirmation', () => {
      expect(getUIFlags(state({
        tripMode: 'plan',
        tripConfirmed: false,
        planningStep: 3,
        hasSummary: true,
      })).ghostCarActive).toBe(false);
    });

    it('inactive without summary', () => {
      expect(getUIFlags(state({
        tripMode: 'plan',
        tripConfirmed: true,
        planningStep: 3,
        hasSummary: false,
      })).ghostCarActive).toBe(false);
    });
  });
});
