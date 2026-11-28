import fixtures from "./questionnaire.fixtures.json";
import {
  evaluate,
  isAnswered,
  progress,
  pruneAnswers,
  visibleSections,
  type Answers,
  type QuestionnaireDefinition,
} from "./questionnaire";

const definition = fixtures.definition as unknown as QuestionnaireDefinition;

describe("backend fixtures", () => {
  it("has cases to run", () => {
    expect(fixtures.cases.length).toBeGreaterThan(0);
  });

  it.each(fixtures.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const got = evaluate(definition, c.answers as Answers);
    expect(got.visible).toEqual(c.expected.visible);
    expect(got.missing).toEqual(c.expected.missing);
    expect(got.errors).toEqual(c.expected.errors);
  });
});

describe("helpers", () => {
  it("treats blank text and empty lists as unanswered", () => {
    expect(isAnswered("  ")).toBe(false);
    expect(isAnswered([])).toBe(false);
    expect(isAnswered(null)).toBe(false);
    expect(isAnswered(false)).toBe(true);
    expect(isAnswered(0)).toBe(true);
  });

  it("prunes answers hidden by their branch and unknown keys", () => {
    const pruned = pruneAnswers(definition, {
      kind: "other",
      name: "Acme",
      products: ["bread"],
      nope: 1,
    });
    expect(pruned).toEqual({ kind: "other", name: "Acme" });
  });

  it("lists only sections with visible questions", () => {
    const sections = visibleSections(definition, { kind: "other" }).map((s) => s.section.key);
    expect(sections).not.toContain("food");
  });

  it("reports progress", () => {
    const p = progress(definition, { kind: "other", name: "Acme", regulated: false });
    expect(p.missingRequired).toBe(0);
    expect(p.answered).toBe(3);
  });
});
