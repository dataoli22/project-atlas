import { getSystemHealthData, WEB_BUILD_VERSION } from "@/lib/system-data";

export async function AppVersionFooter() {
  const { data: health, source } = await getSystemHealthData();

  return (
    <footer className="atlas-note" style={{ padding: "12px 4px", opacity: 0.75 }}>
      Atlas v{WEB_BUILD_VERSION} (web) · backend v{health.backendVersion}
      {source === "api" ? ` · ${health.status}` : " · backend unreachable"}
    </footer>
  );
}
