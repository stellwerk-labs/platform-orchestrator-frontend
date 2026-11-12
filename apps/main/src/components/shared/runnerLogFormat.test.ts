import { describe, expect, it } from 'vitest';

import {
  canFormatRunnerLogs,
  maxRunnerLogRecordBytes,
  parseRunnerLogLine,
  parseRunnerLogs,
} from './runnerLogFormat';

// Producer-equivalent fixtures, not captured customer logs.
export const diagnosticLog =
  '{"@level":"error","@message":"Error: test error","@module":"tofu.ui","@timestamp":"2025-01-08T10:00:00.000000Z","diagnostic":{"severity":"error","summary":"Test Summary","detail":"Test Detail","snippet":{"context":"resource","code":"first\\nsecond"}},"type":"diagnostic"}';

describe('parseRunnerLogLine', () => {
  it('shows the Runner slog message and retains nested runner context', () => {
    const record = parseRunnerLogLine(
      '{"time":"2026-11-12T20:00:00Z","level":"INFO","msg":"IaC binary is available","runner":{"org_id":"fixture-org","version":"OpenTofu v1.10.0\\non darwin_arm64\\n"}}',
    );
    expect(record.text).toBe('IaC binary is available');
    expect(record.metadata).toBe('2026-11-12T20:00:00Z · INFO');
    expect(JSON.parse(record.json!)).toEqual({
      runner: { org_id: 'fixture-org', version: 'OpenTofu v1.10.0\non darwin_arm64\n' },
    });
  });

  it('keeps the complete diagnostic, including multiline source snippets', () => {
    const record = parseRunnerLogLine(diagnosticLog);
    expect(record.text).toBe('Error: test error');
    expect(record.metadata).toContain('tofu.ui · diagnostic');
    expect(JSON.parse(record.json!).diagnostic).toEqual({
      severity: 'error',
      summary: 'Test Summary',
      detail: 'Test Detail',
      snippet: { context: 'resource', code: 'first\nsecond' },
    });
  });

  it('retains unknown fields on new events without an event catalogue', () => {
    const record = parseRunnerLogLine(
      '{"@level":"info","@message":"cost ready\\nnext line","type":"cost_estimate","hook":{"resource":"雪"},"cost":{"monthly":42},"extra":[true,null]}',
    );
    expect(record.text).toBe('cost ready\nnext line');
    expect(JSON.parse(record.json!)).toEqual({
      hook: { resource: '雪' },
      cost: { monthly: 42 },
      extra: [true, null],
    });
  });

  it('ignores structural-looking characters inside escaped log messages', () => {
    const message = '{["quoted\\path]}'.repeat(1000);
    const line = JSON.stringify({ time: 'fixture-time', level: 'INFO', msg: message });
    expect(parseRunnerLogLine(line).text).toBe(message);
  });

  it('falls back before deeply indented pretty output exceeds the record budget', () => {
    const line = '['.repeat(64) + '0,'.repeat(31999) + '0' + ']'.repeat(64);
    expect(line.length).toBeLessThan(maxRunnerLogRecordBytes);
    expect(parseRunnerLogLine(line)).toEqual({ text: line });
  });

  it('bounds whole-body formatting before splitting logs into rows', () => {
    expect(canFormatRunnerLogs('x'.repeat(1024 * 1024 + 1))).toBe(false);
    expect(canFormatRunnerLogs('\n'.repeat(2000))).toBe(false);
    expect(canFormatRunnerLogs('雪'.repeat(400000))).toBe(false);
    expect(canFormatRunnerLogs('plain\n{"cost_estimation":{"monthly":42}}')).toBe(true);
  });

  it('keeps numbers beyond JavaScript precision in their original text', () => {
    const line = '{"@level":"info","@message":"cost","amount":12345678901234567890}';
    expect(parseRunnerLogLine(line)).toEqual({ text: line });
  });

  it('pretty prints unknown JSON without guessing a message wrapper', () => {
    const record = parseRunnerLogLine('{"message":"not a known record","extra":{"value":42}}');
    expect(record.text).toBe('');
    expect(record.json).toBe(
      '{\n  "message": "not a known record",\n  "extra": {\n    "value": 42\n  }\n}',
    );
  });
});

it.each([
  '',
  'plain 雪',
  '{malformed',
  '{"partial":',
  '"' + '\\"'.repeat(32767),
  '```json',
  '\uFFFD',
  '{"@message":"not enough metadata"}',
  '['.repeat(1000) + '0' + ']'.repeat(1000),
  'x'.repeat(maxRunnerLogRecordBytes + 1),
])('retains fallback content (%#)', (line) => {
  const record = parseRunnerLogLine(line);
  if (record.json) expect(JSON.parse(record.json)).toEqual(JSON.parse(line));
  else expect(record.text).toBe(line);
});

it('bounds aggregate pretty output before constructing highlighted rows', () => {
  const line = '['.repeat(64) + '0' + ']'.repeat(64);
  expect(parseRunnerLogs(line)).toHaveLength(1);
  expect(parseRunnerLogs(Array.from({ length: 2000 }, () => line).join('\n'))).toBeUndefined();
});
