import { AskAtlasForm } from "@/components/ask-atlas-form";
import { PageScaffold } from "@/components/page-scaffold";

export default function AskPage() {
  return (
    <PageScaffold
      eyebrow="Shared AI surface"
      title="Ask Atlas"
      description="This shared route now uses explicit feature-aware routing with local Ollama-first execution, deterministic grounding, and token-budgeted prompts that stay aligned with the on-device AI runtime settings."
      tags={["Shared chat", "Feature-aware routing", "Ollama-first"]}
      metrics={[
        { label: "Prompt scope", value: "Endurance / Nutrition" },
        { label: "Grounding", value: "Deterministic data" },
        { label: "Session mode", value: "Local shared shell" }
      ]}
    >
      <AskAtlasForm initialFeature="shared" />
    </PageScaffold>
  );
}
