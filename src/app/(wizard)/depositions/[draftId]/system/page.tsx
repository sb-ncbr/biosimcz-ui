import type { Metadata } from "next";
import { SystemStep } from "@/features/step-system";
import { WizardColumn, WizardPageHeader } from "@/widgets/wizard-shell";

const SystemPage = () => (
  <WizardColumn className="gap-4">
    <WizardPageHeader eyebrow="Step 2 of 3" title="Molecular system" lead="What you simulated and how the system was set up." />
    <SystemStep />
  </WizardColumn>
);

const metadata: Metadata = { title: "Molecular system - New deposition | MDRepo" };

export { metadata };
export default SystemPage;
