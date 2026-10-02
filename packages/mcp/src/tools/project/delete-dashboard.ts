/**
 * Soft-delete dashboard with form elicitation (ADR-0015).
 */

import { registerDeleteDashboard } from '../../destructive/content-soft-delete.js';
import { defineTool } from '../types.js';

export { registerDeleteDashboard };

export const deleteDashboardTool = defineTool('delete_dashboard', registerDeleteDashboard);
