import type { Metadata } from "next";
import { AddRunButton, RunsOverview } from "@/features/step-experiments";
import { WizardColumn, WizardPageHeader } from "@/widgets/wizard-shell";

// Step 3 landing (186:1099): the runs table and the "Add run" type menu.
const ExperimentsPage = () => (
  <WizardColumn width="wide">
    <WizardPageHeader
      eyebrow="Step 3 of 3"
      title="Experiments"
      lead="The runs of your simulation protocol, in the order they ran."
      actions={<AddRunButton />}
    />
    <RunsOverview />
  </WizardColumn>
);

const metadata: Metadata = { title: "Experiments - New deposition | MDRepo" };

export { metadata };
export default ExperimentsPage;
