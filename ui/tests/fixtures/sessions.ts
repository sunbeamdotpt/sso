import { identityJoana, type Identity } from "./identities";

export type Session = {
  id: string;
  active: boolean;
  expires_at: string;
  authenticated_at: string;
  authenticator_assurance_level: "aal1" | "aal2";
  identity?: Identity;
  devices?: Array<{
    id: string;
    ip_address: string;
    user_agent: string;
    location?: string;
  }>;
};

const now = new Date();
const future = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();
const past = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

export const sessionCurrent: Session = {
  id: "session-current",
  active: true,
  expires_at: future(23),
  authenticated_at: past(0.25),
  authenticator_assurance_level: "aal2",
  identity: identityJoana,
  devices: [
    {
      id: "device-1",
      ip_address: "192.0.2.41",
      user_agent: "Mozilla/5.0 (Macintosh) Chrome/139.0",
      location: "Lisbon, PT",
    },
  ],
};

export const sessionList: Session[] = [
  sessionCurrent,
  {
    id: "session-iphone",
    active: true,
    expires_at: future(22),
    authenticated_at: past(0.5),
    authenticator_assurance_level: "aal2",
    identity: identityJoana,
    devices: [
      {
        id: "device-2",
        ip_address: "192.0.2.41",
        user_agent: "Mozilla/5.0 (iPhone) Safari/17.0",
        location: "Lisbon, PT",
      },
    ],
  },
  {
    id: "session-ipad",
    active: true,
    expires_at: future(120),
    authenticated_at: past(48),
    authenticator_assurance_level: "aal1",
    identity: identityJoana,
    devices: [
      {
        id: "device-3",
        ip_address: "5.2.66.1",
        user_agent: "Mozilla/5.0 (iPad) Safari/17.0",
        location: "Porto, PT",
      },
    ],
  },
  {
    id: "session-linux",
    active: false,
    expires_at: past(2),
    authenticated_at: past(120),
    authenticator_assurance_level: "aal1",
    identity: identityJoana,
    devices: [
      {
        id: "device-4",
        ip_address: "81.4.10.7",
        user_agent: "Mozilla/5.0 (X11) Firefox/130.0",
        location: "Faro, PT",
      },
    ],
  },
];
