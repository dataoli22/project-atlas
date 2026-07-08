import { PageScaffold } from "@/components/page-scaffold";
import { PlaceholderPanels } from "@/components/placeholder-panels";

export default function TrackingSettingsPage() {
  return (
    <PageScaffold
      eyebrow="Endurance settings"
      title="Tracking field configuration placeholder"
      description="The tracking settings route is ready for toggling optional manual log fields and preserving the schema-flexible approach called for in the endurance PRD."
      tags={["Tracking", "Optional fields", "Configurable schema"]}
      metrics={[
        { label: "Stable fields", value: "Core first-class" },
        { label: "Flexible fields", value: "Metadata JSON" },
        { label: "Primary use", value: "Personal tailoring" }
      ]}
    >
      <PlaceholderPanels
        primaryLabel="Field toggles"
        primaryText="Optional inputs like load carriage, terrain, altitude, and mobility work can be enabled here."
        secondaryLabel="Preview state"
        secondaryText="A live preview can show how the mobile daily log adapts when fields are enabled or hidden."
      />
    </PageScaffold>
  );
}
