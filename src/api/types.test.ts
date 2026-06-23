import { describe, expect, it } from "vitest";
import {
  findNodeByName,
  findNodesByGroup,
  getFlowError,
  getNodeValue,
} from "./types.ts";
import { mockLoginFlow } from "../test/mocks.ts";

describe("findNodeByName", () => {
  it("finds node by name", () => {
    const node = findNodeByName(mockLoginFlow.ui, "csrf_token");
    expect(node?.attributes.value).toBe("csrf123");
  });
  it("returns undefined for missing node", () => {
    expect(findNodeByName(mockLoginFlow.ui, "nonexistent")).toBeUndefined();
  });
});

describe("findNodesByGroup", () => {
  it("finds nodes by group", () => {
    const nodes = findNodesByGroup(mockLoginFlow.ui, "password");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].attributes.name).toBe("method");
  });
  it("returns empty array for missing group", () => {
    expect(findNodesByGroup(mockLoginFlow.ui, "totp")).toEqual([]);
  });
});

describe("getNodeValue", () => {
  it("returns node value", () => {
    expect(getNodeValue(mockLoginFlow.ui, "csrf_token")).toBe("csrf123");
  });
  it("returns undefined for missing node", () => {
    expect(getNodeValue(mockLoginFlow.ui, "missing")).toBeUndefined();
  });
});

describe("getFlowError", () => {
  it("returns flow-level error message", () => {
    const flow = {
      ...mockLoginFlow.ui,
      messages: [{ type: "error", text: "Bad request", id: 1 }],
    };
    expect(getFlowError(flow)).toBe("Bad request");
  });
  it("returns node-level error message", () => {
    const flow = {
      ...mockLoginFlow.ui,
      messages: [],
      nodes: [{
        ...mockLoginFlow.ui.nodes[0],
        messages: [{ type: "error", text: "Field error", id: 2 }],
      }],
    };
    expect(getFlowError(flow)).toBe("Field error");
  });
  it("returns undefined when no errors", () => {
    expect(getFlowError(mockLoginFlow.ui)).toBeUndefined();
  });
});
