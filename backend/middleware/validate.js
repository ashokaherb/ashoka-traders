/**
 * Validates req.body against a zod schema before the controller runs (audit L1).
 *
 * On success req.body is REPLACED with the parsed result: values are trimmed/converted as
 * the schema says, and any field the schema doesn't list is dropped - so controllers only
 * ever see expected fields (no mass assignment, audit L2).
 *
 * On failure: 400 with the first problem as a readable message, plus the list of fields
 * that failed, e.g. { message: "Enter a valid email address", fields: ["email"] }.
 *
 * @param {import("zod").ZodTypeAny} schema
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const issues = result.error.issues;
    return res.status(400).json({
      message: issues[0].message,
      fields: [...new Set(issues.map((issue) => issue.path.join(".") || "body"))],
      code: "VALIDATION_FAILED",
    });
  }
  req.body = result.data;
  next();
};

module.exports = validate;
