import { z } from 'zod';

export const EXPLORE_ID_DESC = 'Explore ID';

export const exploreIdField = (): z.ZodString => z.string().describe(EXPLORE_ID_DESC);
