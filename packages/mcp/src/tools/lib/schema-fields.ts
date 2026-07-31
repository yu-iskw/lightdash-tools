import { z } from 'zod';

export const PROJECT_UUID_DESC = 'Project UUID';

export const projectUuidField = (): z.ZodString => z.string().describe(PROJECT_UUID_DESC);
