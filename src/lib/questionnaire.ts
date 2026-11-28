/**
 * Business activity questionnaire evaluator (spec 0003, design 2).
 *
 * The app's own implementation, used for live branching on the phone. The
 * backend is the authority and returns its evaluation on every save; this
 * module is proven against the backend's fixtures (questionnaire.test.ts).
 * Pure TypeScript with no platform imports.
 */

export type QuestionType =
  | "text"
  | "long_text"
  | "integer"
  | "date"
  | "month_day"
  | "boolean"
  | "single_select"
  | "multi_select"
  | "person_list";

export interface QuestionOption {
  value: string;
  label: string;
}

export interface PersonField {
  key: string;
  label: string;
  type?: "text" | "number";
  required?: boolean;
  min?: number;
  max?: number;
}

export type ConditionOp = "eq" | "neq" | "in" | "contains" | "is_true" | "answered";

export interface Condition {
  q: string;
  op: ConditionOp;
  value?: unknown;
}

export type VisibleIf = null | { all: Condition[] } | { any: Condition[] };

export interface Question {
  key: string;
  type: QuestionType;
  label: string;
  help?: string;
  required?: boolean;
  options?: QuestionOption[];
  max_length?: number;
  min?: number;
  max?: number;
  max_items?: number;
  fields?: PersonField[];
  visible_if?: VisibleIf;
}

export interface Section {
  key: string;
  title: string;
  description?: string;
  visible_if?: VisibleIf;
  questions: Question[];
}

export interface QuestionnaireDefinition {
  key?: string;
  version?: number;
  content_status?: string;
  sections: Section[];
}

export type Answers = Record<string, unknown>;

export interface FieldError {
  field: string;
  code: string;
}

export interface Evaluation {
  /** Keys of visible questions, in definition order. */
  visible: string[];
  /** Visible, required and unanswered question keys. */
  missing: string[];
  errors: FieldError[];
}

export const DEFAULT_PERSON_FIELDS: readonly PersonField[] = [
  { key: "full_name", label: "Full name", type: "text", required: true },
  { key: "capacity", label: "Role or capacity", type: "text", required: true },
  { key: "ownership_percent", label: "Ownership share (%)", type: "number", min: 0, max: 100 },
];

const TEXT_LIMIT = 500;
const LONG_TEXT_LIMIT = 4000;
const PERSON_TEXT_LIMIT = 200;
const PERSON_LIST_LIMIT = 50;

/** Answered means present and not null, not blank text, not an empty list. */
export function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep equality on JSON values. */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => jsonEqual(item, b[i]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length && keys.every((k) => k in b && jsonEqual(a[k], b[k]))
    );
  }
  return false;
}

function conditionHolds(c: Condition, effective: Answers): boolean {
  const answer = effective[c.q];
  switch (c.op) {
    case "answered":
      return isAnswered(answer);
    case "is_true":
      return answer === true;
    case "eq":
      return isAnswered(answer) && jsonEqual(answer, c.value);
    case "neq":
      // An unanswered question differs from every value.
      return !isAnswered(answer) || !jsonEqual(answer, c.value);
    case "in":
      return (
        isAnswered(answer) && Array.isArray(c.value) && c.value.some((v) => jsonEqual(answer, v))
      );
    case "contains":
      return Array.isArray(answer) && answer.some((v) => jsonEqual(v, c.value));
    default:
      return false;
  }
}

function isVisible(rule: VisibleIf | undefined, effective: Answers): boolean {
  if (!rule) return true;
  if ("all" in rule) return rule.all.every((c) => conditionHolds(c, effective));
  if ("any" in rule) return rule.any.some((c) => conditionHolds(c, effective));
  return true;
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function isIsoDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return m !== null && isCalendarDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

function isMonthDay(text: string): boolean {
  const m = /^(\d{2})-(\d{2})$/.exec(text);
  // Year 2000 is a leap year, so 02-29 is allowed.
  return m !== null && isCalendarDate(2000, Number(m[1]), Number(m[2]));
}

/** Characters as the server counts them (code points). */
function length(text: string): number {
  return Array.from(text).length;
}

function validatePerson(row: unknown, fields: readonly PersonField[]): string | null {
  if (!isRecord(row)) return "invalid_type";
  const byKey = new Map(fields.map((f) => [f.key, f]));
  for (const [key, value] of Object.entries(row)) {
    const field = byKey.get(key);
    if (!field) return "invalid_type";
    if (value === null || value === undefined || value === "") continue;
    if ((field.type ?? "text") === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) return "invalid_type";
      if (value < (field.min ?? 0) || value > (field.max ?? 100)) return "out_of_range";
    } else {
      if (typeof value !== "string") return "invalid_type";
      if (length(value) > PERSON_TEXT_LIMIT) return "too_long";
    }
  }
  for (const field of fields) {
    if (field.required && !isAnswered(row[field.key])) return "invalid_type";
  }
  return null;
}

/** The error code for a non-empty answer, or null when it is valid. */
export function validateAnswer(q: Question, answer: unknown): string | null {
  switch (q.type) {
    case "text":
    case "long_text": {
      if (typeof answer !== "string") return "invalid_type";
      const ceiling = q.type === "text" ? TEXT_LIMIT : LONG_TEXT_LIMIT;
      const max = Math.min(q.max_length ?? ceiling, ceiling);
      return length(answer) > max || answer.includes("\u0000") ? "too_long" : null;
    }
    case "integer": {
      if (typeof answer !== "number" || !Number.isInteger(answer)) return "invalid_type";
      const low = q.min !== undefined && answer < q.min;
      const high = q.max !== undefined && answer > q.max;
      return low || high ? "out_of_range" : null;
    }
    case "date":
      return typeof answer === "string" && isIsoDate(answer) ? null : "invalid_type";
    case "month_day":
      return typeof answer === "string" && isMonthDay(answer) ? null : "invalid_type";
    case "boolean":
      return typeof answer === "boolean" ? null : "invalid_type";
    case "single_select":
      if (typeof answer !== "string") return "invalid_type";
      return (q.options ?? []).some((o) => o.value === answer) ? null : "invalid_option";
    case "multi_select": {
      if (!Array.isArray(answer) || answer.some((v) => typeof v !== "string"))
        return "invalid_type";
      const allowed = new Set((q.options ?? []).map((o) => o.value));
      if (answer.length > (q.max_items || allowed.size)) return "too_many_items";
      const unique = new Set(answer as string[]);
      const unknown = (answer as string[]).some((v) => !allowed.has(v));
      return unknown || unique.size !== answer.length ? "invalid_option" : null;
    }
    case "person_list": {
      if (!Array.isArray(answer)) return "invalid_type";
      if (answer.length > Math.min(q.max_items ?? PERSON_LIST_LIMIT, PERSON_LIST_LIMIT)) {
        return "too_many_items";
      }
      const fields = q.fields && q.fields.length > 0 ? q.fields : DEFAULT_PERSON_FIELDS;
      for (const row of answer) {
        const code = validatePerson(row, fields);
        if (code) return code;
      }
      return null;
    }
    default:
      return "invalid_type";
  }
}

/**
 * Works out which questions are visible, which required ones are unanswered
 * and which answers have problems. Branching looks only at answers to
 * questions that are themselves visible.
 */
export function evaluate(def: QuestionnaireDefinition, answers: Answers): Evaluation {
  const result: Evaluation = { visible: [], missing: [], errors: [] };
  const effective: Answers = {};
  const known = new Set<string>();

  for (const section of def.sections) {
    const sectionShown = isVisible(section.visible_if, effective);
    for (const q of section.questions) {
      known.add(q.key);
      const answer = answers[q.key];
      if (!sectionShown || !isVisible(q.visible_if, effective)) {
        if (isAnswered(answer)) {
          result.errors.push({ field: `answers.${q.key}`, code: "not_applicable" });
        }
        continue;
      }
      result.visible.push(q.key);
      if (!isAnswered(answer)) {
        if (q.required) result.missing.push(q.key);
        continue;
      }
      effective[q.key] = answer;
      const code = validateAnswer(q, answer);
      if (code) result.errors.push({ field: `answers.${q.key}`, code });
    }
  }

  for (const key of Object.keys(answers)) {
    if (!known.has(key)) result.errors.push({ field: `answers.${key}`, code: "unknown_question" });
  }
  return result;
}

/** Sections that have at least one visible question, with those questions. */
export function visibleSections(
  def: QuestionnaireDefinition,
  answers: Answers,
): { section: Section; questions: Question[] }[] {
  const shown = new Set(evaluate(def, answers).visible);
  return def.sections
    .map((section) => ({ section, questions: section.questions.filter((q) => shown.has(q.key)) }))
    .filter((entry) => entry.questions.length > 0);
}

/** Drops answers hidden by their branch, unknown or blank, so a draft never carries them. */
export function pruneAnswers(def: QuestionnaireDefinition, answers: Answers): Answers {
  const shown = new Set(evaluate(def, answers).visible);
  return Object.fromEntries(
    Object.entries(answers).filter(([key, value]) => shown.has(key) && isAnswered(value)),
  );
}

/** Counts for a progress indicator. */
export function progress(
  def: QuestionnaireDefinition,
  answers: Answers,
): { answered: number; visible: number; missingRequired: number } {
  const ev = evaluate(def, answers);
  return {
    answered: ev.visible.filter((key) => isAnswered(answers[key])).length,
    visible: ev.visible.length,
    missingRequired: ev.missing.length,
  };
}
