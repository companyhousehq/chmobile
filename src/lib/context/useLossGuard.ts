import type { UseQueryResult } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { ApiError } from "../api/client";
import { subscribeNotFound } from "../api/notFound";
import { useMe } from "../api/queries";
import { dropContextFromCache } from "./dropContext";
import type { ActingContext } from "./startingContext";

/**
 * Shared by the company and workspace guards. The context query is the probe:
 * a 404 on it means access is gone. A 404 from any other request under the
 * same company or workspace may be a missing sub-resource, so it only
 * re-checks the probe. On loss: drop the context from the caches, alert once,
 * and go to the next available context.
 */
export function useLossGuard(
  ctx: ActingContext,
  probe: UseQueryResult<unknown>,
  message: { title: string; body: string },
  onLost?: (userId: string) => void,
): void {
  const router = useRouter();
  const qc = useQueryClient();
  const userId = useMe().data?.id ?? "";
  const handled = useRef(false);
  const probeRef = useRef(probe);
  useEffect(() => {
    probeRef.current = probe;
  });
  const lost = probe.error instanceof ApiError && probe.error.status === 404;

  useEffect(() => {
    if (!ctx.id) return;
    return subscribeNotFound((scope) => {
      if (scope.kind !== ctx.kind || scope.id !== ctx.id || handled.current) return;
      // The probe's own 404 is already being handled; do not loop on it.
      if (probeRef.current.isFetching) return;
      void probeRef.current.refetch();
    });
  }, [ctx.kind, ctx.id]);

  useEffect(() => {
    if (!lost || !userId || handled.current) return;
    handled.current = true;
    onLost?.(userId);
    dropContextFromCache(qc, userId, { kind: ctx.kind, id: ctx.id });
    Alert.alert(message.title, message.body);
    router.replace("/");
  }, [lost, userId, ctx.kind, ctx.id, qc, router, message.title, message.body, onLost]);
}
