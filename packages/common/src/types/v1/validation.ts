import type { components } from '../generated/openapi-types';

export namespace Validation {
  export type ValidationTarget = components['schemas']['ValidationTarget'];
  export type ApiValidateResponse = components['schemas']['ApiValidateResponse'];
  export type ApiJobScheduledResponse = components['schemas']['ApiJobScheduledResponse'];
  export type ApiValidationDismissResponse = components['schemas']['ApiValidationDismissResponse'];
}
