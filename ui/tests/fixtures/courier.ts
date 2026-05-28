export type CourierMessage = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  channel: "email" | "sms";
  template_type: string;
  status: "queued" | "sent" | "failed" | "abandoned";
  send_count: number;
  created_at: string;
  updated_at: string;
};

const iso = new Date().toISOString();

export const courierMessages: CourierMessage[] = [
  {
    id: "courier-1",
    recipient: "eva.n@studio.pt",
    subject: "Recover your account",
    body: "Use this code to recover your account: 473826",
    channel: "email",
    template_type: "recovery_code_valid",
    status: "sent",
    send_count: 1,
    created_at: iso,
    updated_at: iso,
  },
  {
    id: "courier-2",
    recipient: "aris.t@studio.pt",
    subject: "Verify your email",
    body: "Code: 928174",
    channel: "email",
    template_type: "verification_code_valid",
    status: "sent",
    send_count: 1,
    created_at: iso,
    updated_at: iso,
  },
  {
    id: "courier-3",
    recipient: "beta+1@studio.pt",
    subject: "Your sign-in code",
    body: "Olá,\n\nUse this code to sign in to Sunbeam: 473 826\n\nThe code expires in 10 minutes.",
    channel: "email",
    template_type: "login_code_valid",
    status: "sent",
    send_count: 1,
    created_at: iso,
    updated_at: iso,
  },
  {
    id: "courier-4",
    recipient: "bounce@no-mx.test",
    subject: "Verify your email",
    body: "Code: 555000",
    channel: "email",
    template_type: "verification_code_valid",
    status: "failed",
    send_count: 5,
    created_at: iso,
    updated_at: iso,
  },
];
