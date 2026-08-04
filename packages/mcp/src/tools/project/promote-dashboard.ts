/**
 * Elicitation-gated dashboard promote (ADR-0017).
 */

import { registerPromoteDashboard } from '../../destructive/content-promote.js';
import { defineTool } from '../types.js';

export { registerPromoteDashboard };

export const promoteDashboardTool = defineTool('promote_dashboard', registerPromoteDashboard);
