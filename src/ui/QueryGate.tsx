import type { ReactNode } from "react";
import { ActivityIndicator } from "react-native";
import { ApiError } from "@/lib/api/client";
import { problemMessage } from "@/lib/problems";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "./Button";
import { Notice } from "./Notice";

interface QueryLike {
  isPending: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** Loading, then the API's reason with a retry, then the content. */
export function QueryGate({ queries, children }: { queries: QueryLike[]; children: ReactNode }) {
  const { c } = useTheme();
  const failed = queries.find((q) => q.error);
  if (failed) {
    const problem =
      failed.error instanceof ApiError
        ? failed.error.problem
        : { type: "/problems/unavailable", status: 0 };
    return (
      <>
        <Notice tone="danger">{problemMessage(problem)}</Notice>
        <Button
          label={strings.common.retry}
          variant="secondary"
          onPress={() => queries.forEach((q) => void q.refetch())}
        />
      </>
    );
  }
  if (queries.some((q) => q.isPending)) {
    return <ActivityIndicator accessibilityLabel={strings.common.loading} color={c.accent} />;
  }
  return <>{children}</>;
}
