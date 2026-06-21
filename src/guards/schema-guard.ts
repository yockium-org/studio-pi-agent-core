import { createTextResult, type TextToolResult } from "../responses/result.js";

export type SchemaLike = Record<string, any>;

export type ValidationIssue = {
    path: string;
    expected: string;
    received: string;
    correction: string;
};

export type LocaleGuardFeedback = {
    supported: readonly string[];
    defaultLocale?: string;
    routing?: string;
    updateRule?: string;
    correction?: string;
};

export type SchemaGuardOptions = {
    feedback?: string;
    locale?: LocaleGuardFeedback;
};

const defaultFeedback = "The tool call was not sent to the CMS. Correct the arguments and call the same tool again.";

const summarizeReceivedValue = (value: unknown): string => {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 77)}...` : value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return `[array length ${value.length}]`;
    if (typeof value === "object") return `{object keys: ${Object.keys(value).slice(0, 8).join(", ")}}`;
    return typeof value;
};

const getSchemaVariants = (schema: SchemaLike): SchemaLike[] | undefined => {
    if (Array.isArray(schema?.anyOf)) return schema.anyOf;
    if (Array.isArray(schema?.oneOf)) return schema.oneOf;
    return undefined;
};

const getLiteralValues = (schema: SchemaLike): unknown[] => {
    const variants = getSchemaVariants(schema);
    if (variants) return variants.flatMap(getLiteralValues);
    if (Object.prototype.hasOwnProperty.call(schema ?? {}, "const")) return [schema.const];
    if (Array.isArray(schema?.enum)) return schema.enum;
    return [];
};

const describeSchema = (schema: SchemaLike | undefined): string => {
    if (!schema) return "value matching the declared tool schema";
    const literals = getLiteralValues(schema);
    if (literals.length > 0) return literals.map((value) => JSON.stringify(value)).join(" | ");
    if (schema.type === "array") return `array${schema.minItems ? ` with at least ${schema.minItems} item(s)` : ""}`;
    if (schema.type === "object") return "object";
    if (schema.type === "string") return schema.minLength ? `string with at least ${schema.minLength} character(s)` : "string";
    if (schema.type === "number" || schema.type === "integer") {
        const bounds = [
            typeof schema.minimum === "number" ? `>= ${schema.minimum}` : undefined,
            typeof schema.maximum === "number" ? `<= ${schema.maximum}` : undefined,
        ].filter(Boolean);
        return bounds.length > 0 ? `${schema.type} ${bounds.join(" and ")}` : schema.type;
    }
    if (schema.type === "boolean") return "boolean";
    return "value matching the declared tool schema";
};

const localeCorrection = (options: SchemaGuardOptions | undefined) =>
    options?.locale?.correction ?? "Use an explicit locale value allowed by this project's CMS contract.";

const createValidationIssue = (path: string, expected: string, received: unknown, correction: string): ValidationIssue => ({
    path,
    expected,
    received: summarizeReceivedValue(received),
    correction,
});

export const validateAgainstSchema = (
    schema: SchemaLike,
    value: unknown,
    path = "params",
    options?: SchemaGuardOptions,
): ValidationIssue[] => {
    if (!schema || schema.type === "any") return [];

    const variants = getSchemaVariants(schema);
    if (variants) {
        if (variants.some((variant) => validateAgainstSchema(variant, value, path, options).length === 0)) return [];
        return [createValidationIssue(path, describeSchema(schema), value, "Use one of the allowed schema variants exactly.")];
    }

    const literalValues = getLiteralValues(schema);
    if (literalValues.length > 0) {
        return literalValues.includes(value)
            ? []
            : [
                  createValidationIssue(
                      path,
                      describeSchema(schema),
                      value,
                      path.endsWith(".locale") ? localeCorrection(options) : "Use one of the allowed literal values.",
                  ),
              ];
    }

    if (schema.type === "object") {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return [createValidationIssue(path, "object", value, "Pass a JSON object for this tool call.")];
        }

        const properties = schema.properties ?? {};
        const required = new Set<string>(schema.required ?? []);
        const issues: ValidationIssue[] = [];

        for (const key of required) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) {
                issues.push(
                    createValidationIssue(
                        `${path}.${key}`,
                        describeSchema(properties[key]),
                        undefined,
                        key === "locale" ? localeCorrection(options) : "Add this required field before calling the tool again.",
                    ),
                );
            }
        }

        const objectValue = value as Record<string, unknown>;
        for (const [key, propertySchema] of Object.entries(properties)) {
            if (Object.prototype.hasOwnProperty.call(objectValue, key)) {
                issues.push(...validateAgainstSchema(propertySchema as SchemaLike, objectValue[key], `${path}.${key}`, options));
            }
        }
        return issues;
    }

    if (schema.type === "array") {
        if (!Array.isArray(value)) return [createValidationIssue(path, describeSchema(schema), value, "Pass an array with the declared item shape.")];
        const issues: ValidationIssue[] = [];
        if (typeof schema.minItems === "number" && value.length < schema.minItems) {
            issues.push(createValidationIssue(path, describeSchema(schema), value, `Provide at least ${schema.minItems} item(s).`));
        }
        for (const [index, item] of value.entries()) issues.push(...validateAgainstSchema(schema.items, item, `${path}[${index}]`, options));
        return issues;
    }

    if (schema.type === "string") {
        if (typeof value !== "string") return [createValidationIssue(path, describeSchema(schema), value, "Use a string value.")];
        if (typeof schema.minLength === "number" && value.length < schema.minLength) {
            return [createValidationIssue(path, describeSchema(schema), value, "Use a non-empty string value.")];
        }
    }

    if (schema.type === "number" || schema.type === "integer") {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return [createValidationIssue(path, describeSchema(schema), value, "Use a JSON number, not a string.")];
        }
        if (schema.type === "integer" && !Number.isInteger(value)) return [createValidationIssue(path, describeSchema(schema), value, "Use an integer value.")];
        if (typeof schema.minimum === "number" && value < schema.minimum) return [createValidationIssue(path, describeSchema(schema), value, `Use a number >= ${schema.minimum}.`)];
        if (typeof schema.maximum === "number" && value > schema.maximum) return [createValidationIssue(path, describeSchema(schema), value, `Use a number <= ${schema.maximum}.`)];
    }

    if (schema.type === "boolean" && typeof value !== "boolean") return [createValidationIssue(path, "boolean", value, "Use true or false.")];
    return [];
};

const createGuardFeedbackResult = (toolName: string, issues: ValidationIssue[], options?: SchemaGuardOptions): TextToolResult =>
    createTextResult(
        JSON.stringify(
            {
                ok: false,
                error: "schema_validation_failed",
                tool: toolName,
                feedback: options?.feedback ?? defaultFeedback,
                ...(options?.locale ? { locale: options.locale } : {}),
                issues,
            },
            null,
            2,
        ),
        { kind: "toolSchemaGuard", tool: toolName, ok: false, issues },
    );

export const validateToolParams = (
    toolName: string,
    schema: SchemaLike,
    params: unknown,
    options?: SchemaGuardOptions,
): TextToolResult | undefined => {
    const issues = validateAgainstSchema(schema, params ?? {}, "params", options);
    return issues.length > 0 ? createGuardFeedbackResult(toolName, issues, options) : undefined;
};
