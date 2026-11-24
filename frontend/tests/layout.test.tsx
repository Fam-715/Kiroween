import { fireEvent, render, screen } from "@testing-library/react";
import App from "../src/App";

describe("base layout and routes (task 7.4)", () => {
  it("renders the header, brand link and both nav links with aria-labels", () => {
    render(<App />);
    expect(screen.getByText("Cursed Cassette")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to the tape shelf" }),
    ).toHaveAttribute("aria-label", "Go to the tape shelf");
    expect(screen.getByRole("link", { name: "Open the recorder" })).toBeInTheDocument();
    expect(screen.getByLabelText("Main navigation")).toBeInTheDocument();
  });

  it("renders the skip-to-content link and main landmark", () => {
    render(<App />);
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("shows the shelf route by default with condition text", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "The Shelf" })).toBeInTheDocument();
    // Requirement 9.6: condition is always carried by text, never colour alone.
    expect(screen.getAllByTestId("condition-text").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("condition-text")[0]).toHaveTextContent(
      /mint|worn|warped|haunted|dead/i,
    );
  });

  it("navigates to the recorder route from the shelf button", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: "Record a new tape" }));
    expect(
      screen.getByRole("heading", { name: "Record a Tape" }),
    ).toBeInTheDocument();
    // The shelf (with its second "Record a new tape" link) is gone.
    expect(screen.queryByRole("heading", { name: "The Shelf" })).not.toBeInTheDocument();
  });

  it("navigates to the recorder via the nav and back to the shelf", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: "Open the recorder" }));
    expect(
      screen.getByRole("heading", { name: "Record a Tape" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Go to the tape shelf" }));
    expect(screen.getByRole("heading", { name: "The Shelf" })).toBeInTheDocument();
  });

  it("renders the player route with condition text", () => {
    window.history.pushState({}, "", "/play/abc-123");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Cassette Player" }),
    ).toBeInTheDocument();
    expect(screen.getByText("abc-123")).toBeInTheDocument();
    expect(screen.getByTestId("condition-text")).toHaveTextContent("Mint");
    window.history.pushState({}, "", "/");
  });

  it("gives nav links a visible focus treatment (tabindex is not -1)", () => {
    render(<App />);
    const shelfLink = screen.getByRole("link", {
      name: "Go to the tape shelf",
    });
    expect(shelfLink).not.toHaveAttribute("tabindex", "-1");
  });
});
