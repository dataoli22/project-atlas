import { PageScaffold } from "@/components/page-scaffold";
import { PlaceholderPanels } from "@/components/placeholder-panels";

export default function LogPage() {
  return (
    <PageScaffold
      eyebrow="Endurance module"
      title="Manual logging placeholder"
      description="The log route is prepared for quick daily entry on mobile and deeper editing on desktop, with optional tracking fields staying feature-configurable."
      tags={["Manual input", "Mobile-first", "Configurable fields"]}
      metrics={[
        { label: "Core fields", value: "Hydration, RPE, Mood" },
        { label: "Optional fields", value: "Tags + Metadata" },
        { label: "Capture bias", value: "Phone" }
      ]}
    >
      <PlaceholderPanels
        primaryLabel="Quick entry card"
        primaryText="Touch-sized controls for soreness, pain, hydration, and notes can live here."
        secondaryLabel="Extended schema"
        secondaryText="Desktop layout can reveal optional tags, shoes, terrain, weather, and custom metric inputs."
      />
    </PageScaffold>
  );
}
