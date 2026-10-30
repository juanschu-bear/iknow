/**
 * JSON-Schema für Structured Outputs (Responses API, text.format type json_schema, strict).
 * Strict verlangt: alle Felder required, additionalProperties false.
 * Die Daten eines Bausteins kommen als JSON-String, weil jeder Baustein eine andere Form hat.
 */
export const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "title", "text", "baustein", "baustein_data", "html", "focus"],
  properties: {
    kind: { type: "string", enum: ["baustein", "frei"] },
    title: { type: "string" },
    text: { type: "string" },
    baustein: {
      type: "string",
      enum: ["timeline", "pool", "teeth", "bars", "steps", "cards", "modell", "none"],
    },
    baustein_data: { type: "string" },
    html: { type: "string" },
    focus: { type: "array", items: { type: "string" } },
  },
} as const;
