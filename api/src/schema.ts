import { z } from "zod";
import { MAX_TEXT_LENGTH } from "./types";

export const FactcheckRequestSchema = z.object({
  text: z.string().min(10, "Text must be at least 10 characters").max(MAX_TEXT_LENGTH),
  url: z.string().url().optional(),
  language: z.string().optional(),
});

export function validateAndTruncateText(text: string): string {
  if (text.length > MAX_TEXT_LENGTH) {
    return text.substring(0, MAX_TEXT_LENGTH);
  }
  return text;
}

