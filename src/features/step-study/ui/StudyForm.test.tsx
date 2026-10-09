import { screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDraft, type DepositionDraft } from "@/entities/deposition";
import { createMemoryMirror, DraftProvider, useDraft } from "@/features/draft";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LookupsContext, type StudyLookups } from "../api/lookups";
import { enableShowRequired } from "@/shared/lib/showRequired";
import { StudyForm } from "./StudyForm";

vi.mock("next/navigation", () => ({ usePathname: () => "/depositions/d1/study" }));

beforeAll(() => {
  // Radix and cmdk use browser APIs jsdom does not implement.
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

const lookups: StudyLookups = {
  communities: async () => [{ id: "ceitec", name: "CEITEC", url: "mdrepo.eu/communities/ceitec" }],
  keywords: async () => ["lysozyme"],
  generateDoi: async (draftId) => `10.1234/mdrepo.${draftId}`,
  orcid: async (orcid) =>
    orcid === "0000-0002-1825-0097"
      ? { status: "verified", record: { orcid, givenName: "Josiah", familyName: "Carberry" } }
      : { status: "not_found" },
  organisations: async () => [],
  organisationByRor: async () => null,
};

const Probe = () => {
  const { completeness, draft } = useDraft();
  return (
    <>
      <output data-testid="required">{completeness.steps[0]?.requiredLeft}</output>
      <output data-testid="authors">{draft.study.authors.map((a) => a.givenName).join("|")}</output>
    </>
  );
};

const renderStep = (draft: DepositionDraft = emptyDraft()) =>
  renderWithProviders(
    <LookupsContext.Provider value={lookups}>
      <DraftProvider
      userId="u1"
        mirror={createMemoryMirror()}
        initial={{ id: "d1", status: "draft", revision: 1, createdAt: "2026-09-30T00:00:00Z", updatedAt: "2026-09-30T00:00:00Z", draft, files: [] }}
      >
        <StudyForm />
        <Probe />
      </DraftProvider>
      <Toaster />
    </LookupsContext.Provider>,
  );

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ revision: 2, updatedAt: "2026-09-30T00:01:00Z" }), { status: 200 }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  window.sessionStorage.clear();
  window.location.hash = "";
});
afterEach(() => vi.unstubAllGlobals());

const openSection = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
  await user.click(screen.getByRole("button", { name: new RegExp(`${title}`) }));
};

const addAuthor = async (user: ReturnType<typeof userEvent.setup>, given: string, family: string) => {
  await user.click(screen.getByRole("button", { name: "Add author" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText(/Given name/), given);
  await user.type(within(dialog).getByLabelText(/Family name/), family);
  await user.click(within(dialog).getByRole("button", { name: "Add author" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
};

describe("StudyForm required counts", () => {
  it("opens Basics only, with a required count per section, and updates as fields are filled", async () => {
    const user = userEvent.setup();
    renderStep();
    expect(screen.getByRole("button", { name: /Basics.*2 required/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Credits.*1 required/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publishing.*3 required/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Title/ })).toBeVisible();
    expect(screen.queryByRole("group", { name: /Authors/ })).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /Title/ }), "Lysozyme in water");
    expect(screen.getByRole("button", { name: /Basics.*1 required/ })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Description/ }), "A run.");
    expect(screen.getByRole("button", { name: /Basics.*\+ 2 optional/ })).toBeInTheDocument();
    expect(screen.getByTestId("required")).toHaveTextContent("4");
  });

  it("shows Related work as a ghost section until it is added", async () => {
    const user = userEvent.setup();
    renderStep();
    expect(screen.queryByRole("button", { name: /^(Not started|In progress|Complete)s*Related work/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add Related work" }));
    expect(screen.getByRole("button", { name: /^(Not started|In progress|Complete)s*Related work/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add work" })).toBeVisible();
  });
});

describe("StudyForm validation display", () => {
  it("shows a format error on blur and clears it as soon as the value is fixed", async () => {
    const user = userEvent.setup();
    renderStep();
    const doi = screen.getByRole("textbox", { name: /DOI/ });
    await user.type(doi, "not-a-doi");
    expect(screen.queryByText(/This is not a DOI/)).not.toBeInTheDocument();
    await user.tab();
    expect(await screen.findByText(/This is not a DOI/)).toBeInTheDocument();
    expect(doi).toHaveAttribute("aria-invalid", "true");
    await user.clear(doi);
    await user.type(doi, "10.1234/abcd");
    await waitFor(() => expect(screen.queryByText(/This is not a DOI/)).not.toBeInTheDocument());
  });

  it("keeps required messages hidden until show-required mode is switched on", async () => {
    renderStep();
    expect(screen.queryByText("Add a title.")).not.toBeInTheDocument();
    expect(screen.queryByText("Describe what was simulated and why.")).not.toBeInTheDocument();
    act(() => enableShowRequired("d1"));
    expect(await screen.findByText("Add a title.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Title/ })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Describe what was simulated and why.")).toBeInTheDocument();
  });

  it("does not turn an empty embargo date into a format error", async () => {
    const user = userEvent.setup();
    renderStep();
    await openSection(user, "Publishing");
    await user.click(screen.getByRole("radio", { name: /Open from a date/ }));
    const until = screen.getByRole("textbox", { name: /Open on/ });
    await user.click(until);
    await user.tab();
    expect(screen.queryByText(/Use the format/)).not.toBeInTheDocument();
    await user.type(until, "2020-01-01");
    await user.tab();
    expect(await screen.findByText("Choose a date after today.")).toBeInTheDocument();
  });
});

describe("StudyForm publishing", () => {
  it("counts the embargo date only while Embargoed is chosen", async () => {
    const user = userEvent.setup();
    renderStep();
    await openSection(user, "Publishing");
    await user.click(screen.getByRole("radio", { name: /Anyone can view/ }));
    expect(screen.getByRole("button", { name: /Publishing.*2 required/ })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Open on/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Open from a date/ }));
    expect(screen.getByRole("button", { name: /Publishing.*3 required/ })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /On request/ }));
    expect(screen.queryByRole("textbox", { name: /Open on/ })).not.toBeInTheDocument();
  });

  it("picks a community from the combobox", async () => {
    const user = userEvent.setup();
    renderStep();
    await openSection(user, "Publishing");
    await user.click(screen.getByRole("combobox", { name: /Community/ }));
    await user.click(await screen.findByRole("option", { name: /CEITEC/ }));
    expect(screen.getByRole("combobox", { name: /Community/ })).toHaveTextContent("CEITEC");
    expect(screen.getByRole("button", { name: /Publishing.*2 required/ })).toBeInTheDocument();
  });
});

describe("StudyForm Generate DOI", () => {
  it("fills the DOI field from the lookup and announces it", async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole("button", { name: "Generate DOI" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /DOI/ })).toHaveValue("10.1234/mdrepo.d1"));
    expect(screen.getByText("DOI generated")).toBeInTheDocument();
  });
});

describe("StudyForm credits", () => {
  it("adds, reorders with the keyboard and removes authors, with undo", async () => {
    const user = userEvent.setup();
    renderStep();
    await openSection(user, "Credits");
    await addAuthor(user, "Jana", "Novakova");
    await addAuthor(user, "Petr", "Kovar");
    expect(screen.getByTestId("authors")).toHaveTextContent("Jana|Petr");
    expect(screen.getByRole("button", { name: /Credits.*\+ 2 optional/ }) ?? null).toBeTruthy();

    const grip = screen.getByRole("button", { name: /Reorder Petr Kovar/ });
    grip.focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByTestId("authors")).toHaveTextContent("Petr|Jana");
    await waitFor(() => expect(screen.getByRole("button", { name: /Reorder Petr Kovar/ })).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "More actions for Petr Kovar" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove" }));
    expect(screen.getByTestId("authors")).toHaveTextContent(/^Jana$/);
    // A Sonner toast (regression: it used to be an inline notice inside the list).
    const notice = await screen.findByText(/Petr Kovar removed/);
    expect(notice.closest("[data-sonner-toast]")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByTestId("authors")).toHaveTextContent("Petr|Jana"));
  });

  it("requires names in the editor and verifies an ORCID", async () => {
    const user = userEvent.setup();
    renderStep();
    await openSection(user, "Credits");
    await user.click(screen.getByRole("button", { name: "Add author" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Add author" }));
    expect(await within(dialog).findByText("Enter the given name.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("ORCID"), "0000-0002-1825-0097");
    expect(await within(dialog).findByText("Verified")).toBeInTheDocument();
    // Verified records prefill empty name fields.
    expect(within(dialog).getByLabelText(/Given name/)).toHaveValue("Josiah");
  });

  it("reports an invalid ORCID as a format error", async () => {
    const user = userEvent.setup();
    renderStep();
    await openSection(user, "Credits");
    await user.click(screen.getByRole("button", { name: "Add author" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("ORCID"), "1234");
    await user.tab();
    expect(await within(dialog).findByText(/ORCID is not valid/)).toBeInTheDocument();
  });
});

describe("StudyForm autosave and anchors", () => {
  it("pushes edits into the draft, which autosaves", async () => {
    const user = userEvent.setup();
    renderStep();
    await user.type(screen.getByRole("textbox", { name: /Title/ }), "Lysozyme");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 4000 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/bff/depositions/d1");
    expect(JSON.parse(init.body as string).draft.study.title).toBe("Lysozyme");
  });

  it("gives every registry field a stable anchor id", async () => {
    const user = userEvent.setup();
    renderStep();
    await openSection(user, "Credits");
    await openSection(user, "Publishing");
    for (const id of [
      "field-basics-title",
      "field-basics-description",
      "field-basics-doi",
      "field-basics-keywords",
      "field-credits-authors",
      "field-credits-contributors",
      "field-credits-funding",
      "field-publishing-communityId",
      "field-publishing-access",
      "field-publishing-license",
    ]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it("opens the section and focuses the field when arriving through a Go to field anchor", async () => {
    window.location.hash = "#field-publishing-license";
    renderStep();
    await waitFor(() => expect(document.getElementById("field-publishing-license")).toHaveFocus());
    expect(screen.getByRole("button", { name: /Publishing/ })).toHaveAttribute("aria-expanded", "true");
    // Arriving this way switches on required messages.
    expect(await screen.findByText("Choose a license.")).toBeInTheDocument();
  });
});
