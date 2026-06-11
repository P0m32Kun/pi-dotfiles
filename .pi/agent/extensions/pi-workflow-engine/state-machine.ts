/**
 * State machine for pi-workflow-engine.
 *
 * Provides state management with transitions, guards, and actions.
 */

export interface Transition {
  to: string;
  event: string;
  condition?: string;
  guard?: () => boolean;
}

export interface StateDefinition {
  name: string;
  transitions: Transition[];
  onEnter?: () => void | Promise<void>;
  onExit?: () => void | Promise<void>;
}

export interface HistoryEntry {
  state: string;
  timestamp: number;
  event?: string;
}

export class StateMachine {
  private states: Map<string, StateDefinition>;
  private currentState: string;
  private history: HistoryEntry[];
  private context: Record<string, unknown>;

  constructor(
    states: StateDefinition[],
    initialState: string,
    context: Record<string, unknown> = {}
  ) {
    this.states = new Map();
    for (const state of states) {
      this.states.set(state.name, state);
    }

    if (!this.states.has(initialState)) {
      throw new Error(`Unknown initial state: ${initialState}`);
    }

    this.currentState = initialState;
    this.history = [{ state: initialState, timestamp: Date.now() }];
    this.context = context;
  }

  /**
   * Get the current state.
   */
  getCurrentState(): string {
    return this.currentState;
  }

  /**
   * Transition to a new state.
   */
  async transition(event: string): Promise<void> {
    const stateDef = this.states.get(this.currentState);
    if (!stateDef) {
      throw new Error(`Unknown state: ${this.currentState}`);
    }

    const transition = stateDef.transitions.find(t => t.event === event);
    if (!transition) {
      throw new Error(
        `No transition for event "${event}" in state "${this.currentState}"`
      );
    }

    // Check guard if defined
    if (transition.guard && !transition.guard()) {
      throw new Error('Guard rejected transition');
    }

    // Execute onExit action
    if (stateDef.onExit) {
      await stateDef.onExit();
    }

    // Transition to new state
    const previousState = this.currentState;
    this.currentState = transition.to;

    // Record history
    this.history.push({
      state: this.currentState,
      timestamp: Date.now(),
      event
    });

    // Execute onEnter action
    const newStateDef = this.states.get(this.currentState);
    if (newStateDef?.onEnter) {
      await newStateDef.onEnter();
    }
  }

  /**
   * Check if a transition is valid.
   */
  canTransition(event: string): boolean {
    const stateDef = this.states.get(this.currentState);
    if (!stateDef) return false;

    return stateDef.transitions.some(t => t.event === event);
  }

  /**
   * Get available events for the current state.
   */
  getAvailableEvents(): string[] {
    const stateDef = this.states.get(this.currentState);
    if (!stateDef) return [];

    return stateDef.transitions.map(t => t.event);
  }

  /**
   * Check if the current state is terminal (no transitions).
   */
  isTerminal(): boolean {
    const stateDef = this.states.get(this.currentState);
    if (!stateDef) return true;

    return stateDef.transitions.length === 0;
  }

  /**
   * Get state history.
   */
  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  /**
   * Reset to initial state.
   */
  reset(): void {
    const initialState = this.history[0]?.state;
    if (initialState) {
      this.currentState = initialState;
      this.history = [{ state: initialState, timestamp: Date.now() }];
    }
  }

  /**
   * Get context.
   */
  getContext(): Record<string, unknown> {
    return { ...this.context };
  }

  /**
   * Set context.
   */
  setContext(context: Record<string, unknown>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Get all state names.
   */
  getStateNames(): string[] {
    return Array.from(this.states.keys());
  }

  /**
   * Check if a state exists.
   */
  hasState(name: string): boolean {
    return this.states.has(name);
  }
}

/**
 * Create a state machine from a definition.
 */
export function createStateMachine(config: {
  states: StateDefinition[];
  initialState: string;
  context?: Record<string, unknown>;
}): StateMachine {
  return new StateMachine(
    config.states,
    config.initialState,
    config.context
  );
}
