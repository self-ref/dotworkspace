/**
 * Protocol types for tool communication
 */

/**
 * Base properties shared by all tool events
 */
type ToolEventBase = {
  id: string;        // Unique ID for the tool execution
  tool: string;      // Name of the tool
  timestamp: string; // ISO timestamp
};

/**
 * Tool started event
 */
export type ToolStartedEvent = ToolEventBase & {
  kind: 'started';
};

/**
 * Tool progress event
 */
export type ToolProgressEvent = ToolEventBase & {
  kind: 'progress';
  message: string;
};

/**
 * Tool result event
 */
export type ToolResultEvent = ToolEventBase & {
  kind: 'result';
  result: any;
};

/**
 * Tool error event
 */
export type ToolErrorEvent = ToolEventBase & {
  kind: 'error';
  error: string;
};

/**
 * Discriminated union of all tool events
 */
export type ToolEvent = 
  | ToolStartedEvent
  | ToolProgressEvent
  | ToolResultEvent
  | ToolErrorEvent;

/**
 * Status update sent to clients
 */
export type StatusEvent = {
  kind: 'status';
  status: string;
  timestamp: string;
  [key: string]: any;
};

/**
 * Tool log entry from raw tool execution
 */
export type ToolLog = 
  | { runId: string; kind: 'message'; content: string; }
  | { runId: string; kind: 'result'; content: any; }
  | { runId: string; kind: 'error'; content: any; }; 
