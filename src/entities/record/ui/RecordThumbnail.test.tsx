import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordThumbnail } from "./RecordThumbnail";

describe("RecordThumbnail", () => {
  it("renders a lazy image from the BFF route with descriptive alt text", () => {
    render(<RecordThumbnail accession="MD-A00001" title="MoDEL 12CA" />);
    const image = screen.getByAltText("Structure preview of MoDEL 12CA");
    expect(image).toHaveAttribute("src", "/bff/records/MD-A00001/thumbnail");
    expect(image).toHaveAttribute("loading", "lazy");
  });

  it("falls back to a quiet placeholder in the same box when the image fails", () => {
    render(<RecordThumbnail accession="MD-A00001" title={null} />);
    fireEvent.error(screen.getByAltText("Structure preview of MD-A00001"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("record-thumbnail-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("record-thumbnail")).toHaveClass("size-16", "md:size-[120px]");
  });
});
