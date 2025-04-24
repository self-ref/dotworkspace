import type { DataStreamWriter } from "ai";
import type {
  ToolErrorEvent,
  ToolProgressEvent,
  ToolResultEvent,
  ToolStartedEvent
} from "../../protocol/types";

/**
 * Creates a logger for tool execution
 */
export function createToolLogger(runId: string, toolName: string, dataStream?: DataStreamWriter) {
  const timestamp = () => new Date().toISOString();
  
  // Send the started event
  if (dataStream) {
    const startEvent: ToolStartedEvent = {
      id: runId,
      tool: toolName,
      kind: 'started',
      timestamp: timestamp()
    };
    dataStream.writeData(startEvent);
  }
  
  return {
    /**
     * Log a progress update
     */
    progress(message: string): void {
      console.log(`[${runId}][${toolName}] Progress: ${message}`);
      
      if (dataStream) {
        const event: ToolProgressEvent = {
          id: runId,
          tool: toolName,
          kind: 'progress',
          message,
          timestamp: timestamp()
        };
        dataStream.writeData(event);
      }
    },
    
    /**
     * Log the final result
     */
    result(result: any): void {
      console.log(`[${runId}][${toolName}] Result: ${JSON.stringify(result)}`);
      
      if (dataStream) {
        const event: ToolResultEvent = {
          id: runId,
          tool: toolName,
          kind: 'result',
          result,
          timestamp: timestamp()
        };
        dataStream.writeData(event);
      }
    },
    
    /**
     * Log an error
     */
    error(error: Error | string): void {
      const errorMessage = error instanceof Error ? error.message : error;
      console.error(`[${runId}][${toolName}] Error: ${errorMessage}`);
      
      if (dataStream) {
        const event: ToolErrorEvent = {
          id: runId,
          tool: toolName,
          kind: 'error',
          error: errorMessage,
          timestamp: timestamp()
        };
        dataStream.writeData(event);
      }
    }
  };
}
