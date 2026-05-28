import { useState, useCallback } from "react";
import { css } from "styled-system/css";
import { Button, TextInput } from "@sunbeam/beam-ui";
import type { UIFlow, UINode } from "../api/types.ts";

interface FlowFormProps {
  flow: UIFlow;
  onSubmit: (values: Record<string, unknown>) => void;
  disabled?: boolean;
  submitLabel?: string;
}

function getInitialValues(nodes: UINode[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const node of nodes) {
    const attr = node.attributes;
    if (attr.value !== undefined) {
      values[attr.name] = attr.value;
    }
  }
  return values;
}

function isVisibleInputNode(node: UINode): boolean {
  const attr = node.attributes;
  if (attr.type === "hidden") return false;
  if (attr.type === "submit") return false;
  if (attr.node_type === "script") return false;
  return true;
}

function getSubmitNode(nodes: UINode[]): UINode | undefined {
  return nodes.find((n) => n.attributes.type === "submit");
}

function getInputType(node: UINode): "text" | "email" | "password" | "number" | "checkbox" {
  const type = node.attributes.type;
  switch (type) {
    case "email":
      return "email";
    case "password":
      return "password";
    case "number":
      return "number";
    case "checkbox":
      return "checkbox";
    default:
      return "text";
  }
}

export function FlowForm({ flow, onSubmit, disabled, submitLabel }: FlowFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => getInitialValues(flow.nodes));

  const handleChange = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(values);
    },
    [onSubmit, values],
  );

  const visibleNodes = flow.nodes.filter(isVisibleInputNode);
  const submitNode = getSubmitNode(flow.nodes);
  const label = submitLabel ?? submitNode?.meta?.label?.text ?? "Submit";

  return (
    <form onSubmit={handleSubmit} className={formStack}>
      {visibleNodes.map((node) => {
        const attr = node.attributes;
        const name = attr.name;
        const inputType = getInputType(node);
        const labelText = node.meta?.label?.text ?? name;
        const nodeDisabled = disabled || attr.disabled;

        if (inputType === "checkbox") {
          return (
            <label key={name} className={checkboxLabel}>
              <input
                type="checkbox"
                name={name}
                checked={Boolean(values[name])}
                onChange={(e) => handleChange(name, e.target.checked)}
                disabled={nodeDisabled}
                className={checkboxInput}
              />
              <span className={checkboxText}>{labelText}</span>
            </label>
          );
        }

        return (
          <TextInput
            key={name}
            type={inputType}
            label={labelText}
            value={String(values[name] ?? "")}
            onChange={(value) => handleChange(name, value)}
            disabled={nodeDisabled}
          />
        );
      })}

      <Button variant="primary" type="submit" disabled={disabled}>
        {label}
      </Button>
    </form>
  );
}

const formStack = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
});

const checkboxLabel = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  color: "text.primary",
  fontSize: "sm",
});

const checkboxInput = css({
  cursor: "pointer",
});

const checkboxText = css({
  userSelect: "none",
});
