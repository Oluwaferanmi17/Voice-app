import { CallStatus } from '@prisma/client';

// Defines which states each state is allowed to transition into.
// Anything not listed here is an illegal transition and gets rejected.
const VALID_TRANSITIONS: Record<CallStatus, CallStatus[]> = {
  CALLING:   ['RINGING', 'BUSY', 'ENDED'],        // ENDED = caller cancels before it rings
  RINGING:   ['CONNECTED', 'REJECTED', 'MISSED', 'ENDED'],
  CONNECTED: ['ENDED'],
  BUSY:      [],   // terminal
  REJECTED:  [],   // terminal
  MISSED:    [],   // terminal
  ENDED:     [],   // terminal
};

export class InvalidCallTransitionError extends Error {
  constructor(from: CallStatus, to: CallStatus) {
    super(`Cannot transition call from ${from} to ${to}`);
    this.name = 'InvalidCallTransitionError';
  }
}

export function assertValidTransition(from: CallStatus, to: CallStatus) {
  const allowed = VALID_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new InvalidCallTransitionError(from, to);
  }
}