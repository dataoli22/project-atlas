import { PageScaffold } from "@/components/page-scaffold";
import { PlaceholderPanels } from "@/components/placeholder-panels";

export default function HomePage() {
  return (
    <PageScaffold
      eyebrow="Atlas shell"
      title="A single front door for endurance and nutrition workflows"
      description="This landing view introduces the shared shell contract: persistent feature switching, shared settings, and responsive placeholders that can host either module without tearing the product apart."
      tags={["Shared navigation", "Responsive shell", "Feature-aware routing"]}
      metrics={[
        { label: "Enabled workspaces", value: "2" },
        { label: "Shared routes", value: "4" },
        { label: "Viewport modes", value: "Mobile + Desktop" }
      ]}
    >
      <PlaceholderPanels
        primaryLabel="Desktop shell placeholder"
        primaryText="Persistent sidebar, richer review surfaces, and room for analytics-heavy modules."
        secondaryLabel="Mobile shell placeholder"
        secondaryText="Compact bottom navigation, quick workspace switching, and touch-first summary cards."
      />
    </PageScaffold>
  );
}
