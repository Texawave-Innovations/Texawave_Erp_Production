import { SetMetadata } from "@nestjs/common";

export const RAW_RESPONSE_KEY = "rawResponse";

/** Opt a route out of the `{ data, meta }` envelope — health checks, file
 * downloads, streams, redirects, 204s (Docs/CODING_STANDARDS.md §9). */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
