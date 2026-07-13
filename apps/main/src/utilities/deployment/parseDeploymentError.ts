/**
 * Parsed deployment error information
 */
interface ParsedDeploymentError {
  /** Short human-friendly message for display */
  friendlyMessage: string;

  /** Full raw error message */
  rawMessage: string;

  /** Parsed JSON if available */
  parsedJson?: {
    summary?: string;
    detail?: string;
    action?: string;
    entity_type?: string;
    entity_id?: string;
    module_id?: string;
    module_version?: string;
    provider_type?: string;
    provider_id?: string;
    workload?: string;
  };

  /** Whether the message is JSON */
  isJson: boolean;

  /** Module IDs that failed (for highlighting) */
  failingModuleIds: string[];
}

/** Safely attempt JSON.parse, returning undefined on failure */
function tryParseJson(text: string): Record<string, unknown> | undefined {
  try {
    const result = JSON.parse(text);
    return typeof result === 'object' && result !== null ? result : undefined;
  } catch {
    return undefined;
  }
}

/** Extract the most useful message field from a parsed JSON error */
function extractFriendlyMessage(parsed: Record<string, unknown>): string {
  if (parsed.summary) return String(parsed.summary);
  if (parsed.detail) return String(parsed.detail);
  if (parsed.action) return String(parsed.action);

  // Construct from available fields
  const parts: string[] = [];
  if (parsed.entity_type) parts.push(`${parsed.entity_type} error`);
  if (parsed.entity_id) parts.push(`(${parsed.entity_id})`);
  return parts.length > 0 ? parts.join(' ') : 'Deployment failed';
}

/**
 * Parse deployment error message to extract human-friendly information
 *
 * @param statusMessage - The raw status message from the deployment
 * @returns Parsed error information
 */
export function parseDeploymentError(statusMessage: string): ParsedDeploymentError {
  const parsed = tryParseJson(statusMessage);

  if (parsed) {
    return {
      friendlyMessage: extractFriendlyMessage(parsed),
      rawMessage: statusMessage,
      parsedJson: parsed as ParsedDeploymentError['parsedJson'],
      isJson: true,
      failingModuleIds: parsed.module_id ? [String(parsed.module_id)] : [],
    };
  }

  return {
    friendlyMessage: statusMessage,
    rawMessage: statusMessage,
    isJson: false,
    failingModuleIds: [],
  };
}
