import { AskAtlasForm } from "@/components/ask-atlas-form";
import { PageScaffold } from "@/components/page-scaffold";

export default function AskPage() {
  return (
    <PageScaffold
      eyebrow="Ask Atlas"
      title="Ask Atlas"
      description="A single chat that can answer questions about either your training or your meal plan. It runs on your device by default and always answers using your real, current data - never guesses or made-up numbers."
      tags={["Chat", "Works with both modules", "Runs on your device"]}
      metrics={[
        { label: "Can answer about", value: "Training & nutrition" },
        { label: "Answers based on", value: "Your real data" },
        { label: "Where it runs", value: "This device" }
      ]}
    >
      <AskAtlasForm initialFeature="shared" />
    </PageScaffold>
  );
}
