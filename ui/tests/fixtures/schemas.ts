export const personSchemaV3 = {
  $id: "https://schemas.sunbeam.pt/person/v3.json",
  type: "object",
  properties: {
    traits: {
      type: "object",
      properties: {
        email: {
          type: "string",
          format: "email",
          title: "E-Mail",
        },
        name: {
          type: "object",
          properties: {
            first: { type: "string", title: "First name" },
            last: { type: "string", title: "Last name" },
          },
        },
        locale: { type: "string", enum: ["pt-PT", "en-GB", "es-ES"], title: "Locale" },
        organization_id: { type: "string", format: "uuid", title: "Organization" },
      },
      required: ["email"],
    },
  },
};

export const schemaList = [
  { id: "person@v3", schema: personSchemaV3 },
  { id: "person@v2", schema: { ...personSchemaV3, $id: "person/v2.json" } },
  { id: "service-account", schema: { type: "object" } },
  { id: "guest", schema: { type: "object" } },
];
