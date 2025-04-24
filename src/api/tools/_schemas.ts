import { t } from "elysia";

/** A tool usage example */
export type ToolUsageExample = typeof ToolUsageExampleSchema.static;
export const ToolUsageExampleSchema = t.Object({
  description: t.String({ description: 'A description of the example' }),
  input: t.Any({ description: 'The example input' }),
  result: t.Any({ description: 'The example result' }),
});

/** A tool */
export type Tool = typeof ToolSchema.static;
export const ToolSchema = t.Object({
  name: t.String({ description: 'The name of the tool' }),
  description: t.String({ description: 'A description of the tool' }),
  inputSchema: t.Optional(t.Any({ description: 'The JSON Schema of the tool\'s input' })),
  outputSchema: t.Optional(t.Any({ description: 'The JSON Schema of the tool\'s output' })),
  usageExamples: t.Optional(t.String({ description: 'Example usages of the tool' })),
});

/** An error object */
export const ErrorSchema = t.Object({
  name: t.String({ description: 'The name of the error' }),
  message: t.String({ description: 'The message of the error' }),
  stack: t.Optional(t.String({ description: 'The stack trace of the error' })),
}, { description: 'An error object' });

/** A running tool run's status object */
export type ToolRunRunningStatus = typeof ToolRunRunningStatusSchema.static;
export const ToolRunRunningStatusSchema = t.Object({
  runId: t.String({ description: 'The ID of the tool run' }),
  status: t.Literal('running'),
});

/** A completed tool run's status object */
export type ToolRunCompletedStatus = typeof ToolRunCompletedStatusSchema.static;
export const ToolRunCompletedStatusSchema = t.Object({
  runId: t.String({ description: 'The ID of the tool run' }),
  status: t.Literal('completed'),
  result: t.Any({ description: 'The result of the tool run' }),
});

/** A failed tool run's status object */
export type ToolRunFailedStatus = typeof ToolRunFailedStatusSchema.static;
export const ToolRunFailedStatusSchema = t.Object({
  runId: t.String({ description: 'The ID of the tool run' }),
  status: t.Literal('failed'),
  error: ErrorSchema,
});

/** A tool run's status object */
export type ToolRunStatus = typeof ToolRunStatusSchema.static;
export const ToolRunStatusSchema = t.Union([
  ToolRunRunningStatusSchema,
  ToolRunCompletedStatusSchema,
  ToolRunFailedStatusSchema,
]);
