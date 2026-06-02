import { describe, it, expect } from "vitest";
import { findNodeByName, findNodesByGroup, getNodeValue, getFlowError } from "./types.ts";
import { mockSettingsFlow } from "../test/mocks.ts";

describe("findNodeByName", () => {
  it("finds node by name", () => {
    const node = findNodeByName(mockSettingsFlow.ui, "csrf_token");
    expect(node?.attributes.value).toBe("csrf456");
  });
  it("returns undefined for missing node", () => {
    expect(findNodeByName(mockSettingsFlow.ui, "nonexistent")).toBeUndefined();
  });
});

describe("findNodesByGroup", () => {
  it("finds nodes by group", () => {
    const nodes = findNodesByGroup(mockSettingsFlow.ui, "profile");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].attributes.name).toBe("traits.email");
  });
  it("returns empty array for missing group", () => {
    expect(findNodesByGroup(mockSettingsFlow.ui, "totp")).toEqual([]);
  });
});

describe("getNodeValue", () => {
  it("returns node value", () => {
    expect(getNodeValue(mockSettingsFlow.ui, "csrf_token")).toBe("csrf456");
  });
  it("returns undefined for missing node", () => {
    expect(getNodeValue(mockSettingsFlow.ui, "missing")).toBeUndefined();
  });
});

describe("getFlowError", () => {
  it("returns flow-level error message", () => {
    const flow = { ...mockSettingsFlow.ui, messages: [{ type: "error", text: "Bad request", id: 1 }] };
    expect(getFlowError(flow)).toBe("Bad request");
  });
  it("returns node-level error message", () => {
    const flow = {
      ...mockSettingsFlow.ui,
      messages: [],
      nodes: [{ ...mockSettingsFlow.ui.nodes[0], messages: [{ type: "error", text: "Field error", id: 2 }] }],
    };
    expect(getFlowError(flow)).toBe("Field error");
  });
  it("returns undefined when no errors", () => {
    expect(getFlowError(mockSettingsFlow.ui)).toBeUndefined();
  });
});
