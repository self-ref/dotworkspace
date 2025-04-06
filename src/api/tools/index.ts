import Elysia from 'elysia';
import { createTool } from './createTool';
import { deleteTool } from './deleteTool';
import { deleteToolRun } from './deleteToolRun';
import { getTool } from './getTool';
import { getToolRun } from './getToolRun';
import { getToolRunLogs } from './getToolRunLogs';
import { listToolRuns } from './listToolRuns';
import { listTools } from './listTools';
import { runTool } from './runTool';

export const toolsApi = new Elysia()
  .use(createTool)
  .use(deleteTool)
  .use(deleteToolRun)
  .use(getTool)
  .use(getToolRun)
  .use(getToolRunLogs)
  .use(listToolRuns)
  .use(listTools)
  .use(runTool);
