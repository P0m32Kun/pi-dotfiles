import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateMachine, type StateDefinition, type Transition } from './state-machine.js';

describe('StateMachine', () => {
  const states: StateDefinition[] = [
    {
      name: 'idle',
      transitions: [
        { to: 'running', event: 'start' },
        { to: 'cancelled', event: 'cancel' }
      ]
    },
    {
      name: 'running',
      transitions: [
        { to: 'paused', event: 'pause' },
        { to: 'completed', event: 'finish' },
        { to: 'failed', event: 'fail' }
      ]
    },
    {
      name: 'paused',
      transitions: [
        { to: 'running', event: 'resume' },
        { to: 'cancelled', event: 'cancel' }
      ]
    },
    {
      name: 'completed',
      transitions: []
    },
    {
      name: 'failed',
      transitions: [
        { to: 'running', event: 'retry' }
      ]
    },
    {
      name: 'cancelled',
      transitions: []
    }
  ];

  let stateMachine: StateMachine;

  beforeEach(() => {
    stateMachine = new StateMachine(states, 'idle');
  });

  describe('constructor', () => {
    it('should initialize with the given state', () => {
      expect(stateMachine.getCurrentState()).toBe('idle');
    });

    it('should throw for invalid initial state', () => {
      expect(() => new StateMachine(states, 'invalid')).toThrow('Unknown initial state: invalid');
    });
  });

  describe('transition', () => {
    it('should transition to a valid state', async () => {
      await stateMachine.transition('start');
      expect(stateMachine.getCurrentState()).toBe('running');
    });

    it('should throw for invalid event', async () => {
      await expect(stateMachine.transition('invalid')).rejects.toThrow(
        'No transition for event "invalid" in state "idle"'
      );
    });

    it('should throw for event that is not valid in current state', async () => {
      await expect(stateMachine.transition('finish')).rejects.toThrow(
        'No transition for event "finish" in state "idle"'
      );
    });

    it('should track state history', async () => {
      await stateMachine.transition('start');
      await stateMachine.transition('pause');

      const history = stateMachine.getHistory();
      expect(history).toHaveLength(3); // idle (initial) -> running -> paused
      expect(history[0]).toEqual({ state: 'idle', timestamp: expect.any(Number) });
      expect(history[1]).toEqual({ state: 'running', timestamp: expect.any(Number), event: 'start' });
      expect(history[2]).toEqual({ state: 'paused', timestamp: expect.any(Number), event: 'pause' });
    });
  });

  describe('canTransition', () => {
    it('should return true for valid transition', () => {
      expect(stateMachine.canTransition('start')).toBe(true);
    });

    it('should return false for invalid transition', () => {
      expect(stateMachine.canTransition('finish')).toBe(false);
    });
  });

  describe('getAvailableEvents', () => {
    it('should return available events for current state', () => {
      const events = stateMachine.getAvailableEvents();
      expect(events).toEqual(['start', 'cancel']);
    });

    it('should return empty array for terminal state', async () => {
      await stateMachine.transition('start');
      await stateMachine.transition('finish');

      const events = stateMachine.getAvailableEvents();
      expect(events).toEqual([]);
    });
  });

  describe('isTerminal', () => {
    it('should return false for non-terminal state', () => {
      expect(stateMachine.isTerminal()).toBe(false);
    });

    it('should return true for terminal state', async () => {
      await stateMachine.transition('start');
      await stateMachine.transition('finish');

      expect(stateMachine.isTerminal()).toBe(true);
    });
  });

  describe('guards', () => {
    it('should support transition guards', async () => {
      const guard = vi.fn().mockReturnValue(true);
      
      const guardedStates: StateDefinition[] = [
        {
          name: 'idle',
          transitions: [
            { to: 'running', event: 'start', guard }
          ]
        },
        {
          name: 'running',
          transitions: []
        }
      ];

      const sm = new StateMachine(guardedStates, 'idle');
      await sm.transition('start');

      expect(guard).toHaveBeenCalled();
      expect(sm.getCurrentState()).toBe('running');
    });

    it('should reject transition when guard returns false', async () => {
      const guard = vi.fn().mockReturnValue(false);
      
      const guardedStates: StateDefinition[] = [
        {
          name: 'idle',
          transitions: [
            { to: 'running', event: 'start', guard }
          ]
        },
        {
          name: 'running',
          transitions: []
        }
      ];

      const sm = new StateMachine(guardedStates, 'idle');
      await expect(sm.transition('start')).rejects.toThrow('Guard rejected transition');
    });
  });

  describe('actions', () => {
    it('should execute on_enter action', async () => {
      const onEnter = vi.fn();
      
      const actionStates: StateDefinition[] = [
        {
          name: 'idle',
          transitions: [{ to: 'running', event: 'start' }]
        },
        {
          name: 'running',
          transitions: [],
          onEnter
        }
      ];

      const sm = new StateMachine(actionStates, 'idle');
      await sm.transition('start');

      expect(onEnter).toHaveBeenCalled();
    });

    it('should execute on_exit action', async () => {
      const onExit = vi.fn();
      
      const actionStates: StateDefinition[] = [
        {
          name: 'idle',
          transitions: [{ to: 'running', event: 'start' }],
          onExit
        },
        {
          name: 'running',
          transitions: []
        }
      ];

      const sm = new StateMachine(actionStates, 'idle');
      await sm.transition('start');

      expect(onExit).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      await stateMachine.transition('start');
      await stateMachine.transition('pause');

      stateMachine.reset();

      expect(stateMachine.getCurrentState()).toBe('idle');
      expect(stateMachine.getHistory()).toHaveLength(1);
    });
  });

  describe('context', () => {
    it('should support state context', async () => {
      const sm = new StateMachine(states, 'idle', { counter: 0 });
      
      expect(sm.getContext()).toEqual({ counter: 0 });
      
      sm.setContext({ counter: 1 });
      expect(sm.getContext()).toEqual({ counter: 1 });
    });
  });
});
