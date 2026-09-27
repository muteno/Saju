export const UNKNOWN_BIRTH_TIME_NOTICE: string
export interface UnknownBirthTime { status: 'unknown'; policy: 'withhold-unverified-v1' }
export function hasUnknownBirthTime(value: unknown, legacyFlag?: boolean): boolean
export function unknownBirthTime(): UnknownBirthTime
