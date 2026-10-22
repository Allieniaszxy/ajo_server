import { ApiError } from "../utils/ApiError.js";

const PARTS = ["body", "query", "params"];

/**
 * validate({ body: zodSchema, query: zodSchema, params: zodSchema })
 * Parsed (and normalised) data goes on req.validated, never back onto
 * req.query, which is read-only in Express 5.
 */
export const validate = (schemas) => (req, _res, next) => {
  const validated = {};
  const problems = [];

  for (const part of PARTS) {
    const schema = schemas[part];
    if (!schema) continue;

    // In Express 5, req.body is undefined when a request has no body
    const input = part === "body" ? (req.body ?? {}) : req[part];
    const result = schema.safeParse(input);

    if (result.success) {
      validated[part] = result.data;
    } else {
      for (const issue of result.error.issues) {
        problems.push({
          in: part,
          path: issue.path.join("."),
          message: issue.message,
        });
      }
    }
  }

  if (problems.length > 0) {
    return next(
      new ApiError(400, "Validation failed", {
        code: "VALIDATION_ERROR",
        details: problems,
      }),
    );
  }

  req.validated = validated;
  next();
};
