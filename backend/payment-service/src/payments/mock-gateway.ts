import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export type Scenario = 'SUCCESS' | 'FAILURE' | 'TIMEOUT';
export type GatewayOutcome = 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';

// A pretend payment provider. It only decides an outcome; no card number, bank or money is involved.
@Injectable()
export class MockGateway {
  constructor(private readonly config: ConfigService) {}

  charge(scenario: Scenario): { outcome: GatewayOutcome; ref: string; reason?: string } {
    const ref = `mock_${randomUUID()}`;
    switch (scenario) {
      case 'SUCCESS':
        return { outcome: 'SUCCEEDED', ref };
      case 'FAILURE':
        return { outcome: 'FAILED', ref, reason: 'CARD_DECLINED' };
      default:
        // TIMEOUT: our request to the "bank" timed out, so we do NOT know what happened.
        return { outcome: 'UNKNOWN', ref };
    }
  }

  // "Ask the bank what really happened" for a payment whose result we never received.
  lookup(): 'SUCCEEDED' | 'FAILED' {
    return this.config.get('TIMEOUT_RESOLVES_TO') === 'FAILED' ? 'FAILED' : 'SUCCEEDED';
  }
}
