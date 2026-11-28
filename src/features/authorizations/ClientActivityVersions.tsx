import { useLocalSearchParams } from "expo-router";
import { VersionDetail } from "@/features/company/ActivityVersionScreen";
import { VersionsList } from "@/features/company/ActivityVersionsScreen";
import { useWorkspaceId } from "@/features/workspace/useWorkspaceId";
import { useClientVersion, useClientVersions } from "@/lib/api/authorizations";

/** A client's business-activity history, read-only, through the workspace's access. */
export function ClientActivityVersionsScreen() {
  const id = useWorkspaceId();
  const { companyId } = useLocalSearchParams<{ companyId: string }>();
  const cid = companyId ?? "";
  const list = useClientVersions(id, cid);
  return (
    <VersionsList list={list} hrefFor={(n) => `/w/${id}/client/${cid}/activity/versions/${n}`} />
  );
}

export function ClientActivityVersionScreen() {
  const id = useWorkspaceId();
  const { companyId, version } = useLocalSearchParams<{ companyId: string; version: string }>();
  const n = Number(version);
  const q = useClientVersion(id, companyId ?? "", n);
  return <VersionDetail n={n} q={q} />;
}
