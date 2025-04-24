import type { ToolLog } from './types';

/**
 * Parses a single line of tool log output
 * Format: [runId] kind: content
 */
export function parseToolLog(line: string): ToolLog | null {
  const match = line.match(/\[([^\]]+)\]\s+(message|result|error):\s+(.*)/);
  if (!match) return null;
  
  const [, runId, kind, content] = match;
  
  if (kind === 'message') {
    return { runId, kind, content: content.trim() };
  }
  
  // Try to parse result/error as JSON first
  if (kind === 'result' || kind === 'error') {
    try {
      return { runId, kind, content: JSON.parse(content) };
    } catch {
      return { runId, kind, content: content.trim() };
    }
  }
  
  return null;
}

/**
 * Formats a tool log entry for consistent output
 */
export function formatToolLog(runId: string, kind: 'message' | 'result' | 'error', content: any): string {
  if (kind === 'result' || kind === 'error') {
    return `[${runId}] ${kind}: ${JSON.stringify(content)}`;
  }
  return `[${runId}] ${kind}: ${content}`;
}

/**
 * Processes a buffer of tool logs into structured entries
 */
export function processToolLogsBuffer(buffer: string): { 
  entries: ToolLog[],
  remainder: string 
} {
  // Simple implementation to split logs by newlines
  if (!buffer.includes('\n')) {
    return { entries: [], remainder: buffer };
  }
  
  const lines = buffer.split('\n');
  const remainder = lines.pop() || '';
  
  const entries = lines
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(parseToolLog)
    .filter((entry): entry is ToolLog => entry !== null);
  
  return { entries, remainder };
} 