export const maxRunnerLogRecordBytes = 64 * 1024;
const maxFormattedLogBytes = 1024 * 1024;
const maxFormattedLogLines = 2000;

export interface RunnerLogRecord {
  text: string;
  json?: string;
  metadata?: string;
  level?: string;
}

export const canFormatRunnerLogs = (content: string) => {
  if (
    content.length > maxFormattedLogBytes ||
    new TextEncoder().encode(content).length > maxFormattedLogBytes
  )
    return false;
  let lines = 1;
  for (const character of content) {
    if (character === '\n') lines++;
    if (lines > maxFormattedLogLines) return false;
  }
  return true;
};

// Bound input, nesting and the expanded representation, retaining the original
// line whenever pretty printing cannot safely fit the record budget.
const hasBoundedJSONLayout = (line: string) => {
  let depth = 0;
  let length = new TextEncoder().encode(line).length;
  // Quoted strings are a single token, so payload braces do not count as nesting.
  for (const [token] of line.matchAll(/"(?:[^"\\]|\\.)*"|[{}[\],:]/g)) {
    if (token === '{' || token === '[') {
      depth++;
      length += depth * 2 + 1;
    } else if (token === '}' || token === ']') {
      depth--;
      length += depth * 2 + 1;
    } else if (token === ',') length += depth * 2 + 1;
    else if (token === ':') length++;
    if (depth > 64 || length > maxRunnerLogRecordBytes) return false;
  }
  return true;
};

const isUnsafeRunnerLogNumber = (value: unknown) =>
  typeof value === 'number' &&
  (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)));

const readRunnerLogJSON = (line: string): unknown => {
  if (line.length > maxRunnerLogRecordBytes) return undefined;
  try {
    let unsafeNumber = false;
    const value: unknown = JSON.parse(line, (_key, parsed) => {
      if (isUnsafeRunnerLogNumber(parsed)) unsafeNumber = true;
      return parsed;
    });
    // Only scan valid JSON, since an unfinished quoted string can cause regex backtracking.
    if (
      unsafeNumber ||
      !hasBoundedJSONLayout(line) ||
      new TextEncoder().encode(JSON.stringify(value, null, 2)).length > maxRunnerLogRecordBytes
    )
      return undefined;
    return value;
  } catch {
    return undefined;
  }
};

const runnerLogMessageKeys = (fields: Record<string, unknown>) => {
  if (typeof fields['@message'] === 'string' && typeof fields['@level'] === 'string')
    return {
      message: '@message',
      level: '@level',
      metadata: ['@timestamp', '@level', '@module', 'type'],
    };
  if (
    typeof fields.msg === 'string' &&
    typeof fields.level === 'string' &&
    typeof fields.time === 'string'
  )
    return { message: 'msg', level: 'level', metadata: ['time', 'level'] };
  return undefined;
};

const formatRunnerLogRecord = (fields: Record<string, unknown>): RunnerLogRecord | undefined => {
  const keys = runnerLogMessageKeys(fields);
  if (!keys) return undefined;
  const payload = { ...fields };
  delete payload[keys.message];
  const metadata: string[] = [];
  for (const key of keys.metadata) {
    if (typeof fields[key] === 'string') {
      metadata.push(fields[key]);
      delete payload[key];
    }
  }
  return {
    text: fields[keys.message] as string,
    metadata: metadata.join(' · '),
    level: fields[keys.level] as string,
    json: Object.keys(payload).length ? JSON.stringify(payload, null, 2) : undefined,
  };
};

export const parseRunnerLogLine = (line: string): RunnerLogRecord => {
  const value = readRunnerLogJSON(line);
  if (value === undefined) return { text: line };
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = formatRunnerLogRecord(value as Record<string, unknown>);
    if (record) return record;
  }
  return { text: '', json: JSON.stringify(value, null, 2) };
};

export const parseRunnerLogs = (content: string): RunnerLogRecord[] | undefined => {
  if (!canFormatRunnerLogs(content)) return undefined;
  const records: RunnerLogRecord[] = [];
  let formattedBytes = 0;
  for (const line of content.split('\n')) {
    const record = parseRunnerLogLine(line);
    formattedBytes +=
      new TextEncoder().encode(record.text + (record.metadata ?? '') + (record.json ?? '')).length +
      2;
    if (formattedBytes > maxFormattedLogBytes) return undefined;
    records.push(record);
  }
  return records;
};
