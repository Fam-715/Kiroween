import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import App from "../src/App";

describe("scaffold", () => {
  it("renders the app title", () => {
    render(<App />);
    expect(screen.getByText("Cursed Cassette")).toBeInTheDocument();
  });

  it("fast-check is wired up", () => {
    fc.assert(fc.property(fc.integer(), (n) => n + 0 === n));
  });
});
