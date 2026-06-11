import { z } from 'zod';

export const PROJECT_UUID_DESC = 'Project UUID';
export const SPACE_UUID_DESC = 'Space UUID';
export const EXPLORE_ID_DESC = 'Explore ID';
export const GROUP_UUID_DESC = 'Group UUID';
export const USER_UUID_DESC = 'User UUID';

export const projectUuidField = (): z.ZodString => z.string().describe(PROJECT_UUID_DESC);
export const spaceUuidField = (): z.ZodString => z.string().describe(SPACE_UUID_DESC);
export const exploreIdField = (): z.ZodString => z.string().describe(EXPLORE_ID_DESC);
export const groupUuidField = (): z.ZodString => z.string().describe(GROUP_UUID_DESC);
export const userUuidField = (): z.ZodString => z.string().describe(USER_UUID_DESC);
