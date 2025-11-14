import { describe, it, expect } from 'vitest';
import { getConfig, DEFAULT_SOURCES } from '../src/lib/config.js';

describe('getConfig', () => {
  it('uses defaults when env is empty', () => {
    const config = getConfig({});
    expect(config.allowHosts.length).toBeGreaterThan(0);
    expect(config.sources).toEqual(DEFAULT_SOURCES);
  });

  it('parses overrides from env.vars', () => {
    const env = { vars: { ALLOW_HOSTS: 'example.com' } };
    const config = getConfig(env);
    expect(config.allowHosts).toEqual(['example.com']);
  });
});
