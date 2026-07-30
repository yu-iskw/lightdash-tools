import { z } from 'zod';

export const PROJECT_UUID_DESC = 'Project UUID';
export const EXPLORE_ID_DESC = 'Explore ID';

export const projectUuidField = (): z.ZodString => z.string().describe(PROJECT_UUID_DESC);
export const exploreIdField = (): z.ZodString => z.string().describe(EXPLORE_ID_DESC);
