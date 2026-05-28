export type Identity = {
  id: string;
  schema_id: string;
  schema_url: string;
  state: "active" | "inactive";
  state_changed_at?: string;
  traits: Record<string, unknown>;
  verifiable_addresses?: Array<{
    id: string;
    value: string;
    verified: boolean;
    via: string;
    status: string;
  }>;
  recovery_addresses?: Array<{ id: string; value: string; via: string }>;
  metadata_public?: Record<string, unknown>;
  metadata_admin?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const isoNow = new Date().toISOString();

export const identityJoana: Identity = {
  id: "8e9105a2-58a0-4b1c-9d33-7e6a2ab44f10",
  schema_id: "person@v3",
  schema_url: "/schemas/person@v3",
  state: "active",
  state_changed_at: isoNow,
  traits: {
    email: "j.silva@studio.pt",
    name: { first: "Joana", last: "Silva" },
    locale: "pt-PT",
    organization_id: "org_studiocorp",
  },
  verifiable_addresses: [
    {
      id: "verifiable-id-1",
      value: "j.silva@studio.pt",
      verified: true,
      via: "email",
      status: "completed",
    },
  ],
  recovery_addresses: [{ id: "recovery-id-1", value: "j.silva@studio.pt", via: "email" }],
  created_at: "2024-03-04T10:00:00Z",
  updated_at: isoNow,
};

export const identityList: Identity[] = [
  identityJoana,
  {
    id: "7c4b13f0-1234-5678-90ab-cdef12345678",
    schema_id: "person@v3",
    schema_url: "/schemas/person@v3",
    state: "active",
    traits: {
      email: "aris.t@studio.pt",
      name: { first: "Aris", last: "Telemachus" },
      locale: "en-GB",
    },
    verifiable_addresses: [
      {
        id: "v-2",
        value: "aris.t@studio.pt",
        verified: true,
        via: "email",
        status: "completed",
      },
    ],
    created_at: isoNow,
    updated_at: isoNow,
  },
  {
    id: "21ab09c4-aaaa-bbbb-cccc-dddddddddddd",
    schema_id: "person@v3",
    schema_url: "/schemas/person@v3",
    state: "active",
    traits: {
      email: "eva.n@studio.pt",
      name: { first: "Eva", last: "Nunes" },
    },
    verifiable_addresses: [
      {
        id: "v-3",
        value: "eva.n@studio.pt",
        verified: false,
        via: "email",
        status: "pending",
      },
    ],
    created_at: "2025-02-18T10:00:00Z",
    updated_at: isoNow,
  },
];
