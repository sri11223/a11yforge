import type { Finding } from "../types.js";

/**
 * Human checkpoint — where the advanced agent defers instead of guessing on
 * ambiguous semantic cases (e.g. alt text that could be valid or could be a
 * decorative call). Items are queued for review rather than auto-passed/failed.
 */

export interface ReviewItem {
  finding: Finding;
  selector: string;
  proposed: string;
  question: string;
}

/**
 * TODO(step-later): persist review items to an artifact for the reviewer UI/CLI.
 */
export function queueForReview(_item: ReviewItem): void {
  throw new Error("TODO: human checkpoint not implemented yet");
}
