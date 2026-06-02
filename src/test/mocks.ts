export const mockLoginFlow = {
  id: "flow-test",
  type: "login",
  ui: {
    action: "/self-service/login?flow=flow-test",
    method: "POST",
    nodes: [
      {
        type: "input",
        group: "default",
        attributes: { name: "csrf_token", type: "hidden", value: "csrf123" },
      },
      {
        type: "input",
        group: "default",
        attributes: { name: "identifier", type: "email", value: "" },
        meta: { label: { text: "E-Mail", type: "info", id: 1 } },
      },
      {
        type: "input",
        group: "default",
        attributes: { name: "password", type: "password", value: "" },
        meta: { label: { text: "Password", type: "info", id: 2 } },
      },
      {
        type: "input",
        group: "password",
        attributes: { name: "method", type: "submit", value: "password" },
        meta: { label: { text: "Sign in", type: "info", id: 3 } },
      },
    ],
    messages: [],
  },
};

export const mockSettingsFlow = {
  id: "settings-test",
  type: "settings",
  ui: {
    action: "/self-service/settings?flow=settings-test",
    method: "POST",
    nodes: [
      {
        type: "input",
        group: "default",
        attributes: { name: "csrf_token", type: "hidden", value: "csrf456" },
      },
      {
        type: "input",
        group: "profile",
        attributes: { name: "traits.email", type: "email", value: "test@example.com" },
        meta: { label: { text: "E-Mail", type: "info", id: 1 } },
      },
      {
        type: "input",
        group: "password",
        attributes: { name: "password", type: "password", value: "" },
        meta: { label: { text: "New password", type: "info", id: 2 } },
      },
    ],
    messages: [],
  },
};
