/**
 * Soft-delete chart with form elicitation (ADR-0015).
 */

import { registerDeleteChart } from '../../destructive/content-soft-delete.js';
import { defineTool } from '../types.js';

export { registerDeleteChart };

export const deleteChartTool = defineTool('delete_chart', registerDeleteChart);
