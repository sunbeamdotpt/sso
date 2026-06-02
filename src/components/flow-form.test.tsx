import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlowForm } from "./flow-form.tsx";
import { mockSettingsFlow } from "../test/mocks.ts";

vi.mock("@sunbeam/beam-ui", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  TextInput: ({ label, value, onChange, disabled, type }: any) => (
    <label>
      {label}
      <input
        type={type}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </label>
  ),
}));

describe("FlowForm", () => {
  it("renders visible input nodes", () => {
    const onSubmit = vi.fn();
    render(<FlowForm flow={mockSettingsFlow.ui} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("E-Mail")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("submits with current values", () => {
    const onSubmit = vi.fn();
    render(<FlowForm flow={mockSettingsFlow.ui} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      "traits.email": "new@example.com",
      "csrf_token": "csrf456",
    }));
  });

  it("respects disabled prop", () => {
    const onSubmit = vi.fn();
    render(<FlowForm flow={mockSettingsFlow.ui} onSubmit={onSubmit} disabled />);
    expect(screen.getByLabelText("E-Mail")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("renders checkbox input nodes", () => {
    const onSubmit = vi.fn();
    const flowWithCheckbox = {
      ...mockSettingsFlow.ui,
      nodes: [
        ...mockSettingsFlow.ui.nodes,
        {
          type: "input",
          group: "default",
          attributes: { name: "remember", type: "checkbox", value: true },
          meta: { label: { text: "Remember me", type: "info", id: 3 } },
        },
      ],
    };
    render(<FlowForm flow={flowWithCheckbox} onSubmit={onSubmit} />);
    const checkbox = screen.getByLabelText("Remember me") as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.type).toBe("checkbox");
    expect(checkbox.checked).toBe(true);
  });

  it("renders number input nodes", () => {
    const onSubmit = vi.fn();
    const flowWithNumber = {
      ...mockSettingsFlow.ui,
      nodes: [
        ...mockSettingsFlow.ui.nodes,
        {
          type: "input",
          group: "default",
          attributes: { name: "age", type: "number", value: "30" },
          meta: { label: { text: "Age", type: "info", id: 3 } },
        },
      ],
    };
    render(<FlowForm flow={flowWithNumber} onSubmit={onSubmit} />);
    const numberInput = screen.getByLabelText("Age") as HTMLInputElement;
    expect(numberInput).toBeInTheDocument();
    expect(numberInput.type).toBe("number");
  });

  it("uses submit node label when available", () => {
    const onSubmit = vi.fn();
    const flowWithSubmitLabel = {
      ...mockSettingsFlow.ui,
      nodes: [
        ...mockSettingsFlow.ui.nodes,
        {
          type: "input",
          group: "password",
          attributes: { name: "method", type: "submit", value: "password" },
          meta: { label: { text: "Save changes", type: "info", id: 99 } },
        },
      ],
    };
    render(<FlowForm flow={flowWithSubmitLabel} onSubmit={onSubmit} />);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("uses custom submitLabel prop over node label", () => {
    const onSubmit = vi.fn();
    render(<FlowForm flow={mockSettingsFlow.ui} onSubmit={onSubmit} submitLabel="Custom Label" />);
    expect(screen.getByRole("button", { name: "Custom Label" })).toBeInTheDocument();
  });
});
