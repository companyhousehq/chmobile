import { View } from "react-native";
import { formatAnswer } from "@/lib/company";
import { visibleSections, type Answers, type QuestionnaireDefinition } from "@/lib/questionnaire";
import { strings } from "@/strings";
import { space } from "@/theme/tokens";
import { Card } from "@/ui/Card";
import { Text } from "@/ui/Text";

/** Read-only answers by section. Used for members who can't edit and for past versions (M22). */
export function AnswersView({
  definition,
  answers,
}: {
  definition: QuestionnaireDefinition;
  answers: Answers;
}) {
  return (
    <>
      {visibleSections(definition, answers).map(({ section, questions }) => (
        <Card key={section.key}>
          <Text bold accessibilityRole="header">
            {section.title}
          </Text>
          {questions.map((q) => {
            const text = formatAnswer(q, answers[q.key]);
            return (
              <View key={q.key} style={{ gap: space[1] }}>
                <Text variant="footnote" tone="textMuted">
                  {q.label}
                </Text>
                <Text>{text || strings.co.activity.unanswered}</Text>
              </View>
            );
          })}
        </Card>
      ))}
    </>
  );
}
