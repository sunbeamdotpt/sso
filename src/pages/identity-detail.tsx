import { useState, useCallback, useEffect } from "react";
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { useRestQuery, useRestMutation } from "@sunbeam/g2v";
import { Badge, Tabs, Icon, Button, ScrollArea, Toast, TextInput, Checkbox, TagsInput } from "@sunbeam/beam-ui";
import { css } from "styled-system/css";
import { api } from "../api/client.ts";
import type { Identity, IdentitySchema, UpdateIdentity, VerifiableAddress } from "../api/types.ts";

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Try to parse JSON error bodies from the REST client
    try {
      const parsed = JSON.parse(err.message);
      const detail =
        parsed?.message ??
        parsed?.error?.message ??
        parsed?.error?.reason ??
        parsed?.reason ??
        JSON.stringify(parsed);
      return detail;
    } catch {
      return err.message;
    }
  }
  return String(err);
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getDisplayName(identity: Identity): string {
  const traits = identity.traits as Record<string, unknown>;
  const given = typeof traits?.given_name === "string" ? traits.given_name : "";
  const family = typeof traits?.family_name === "string" ? traits.family_name : "";
  const fullName = `${given} ${family}`.trim();
  if (fullName) return fullName;

  const nameObj = traits?.name as Record<string, string> | undefined;
  if (nameObj?.first || nameObj?.last) {
    return `${nameObj.first ?? ""} ${nameObj.last ?? ""}`.trim();
  }

  if (typeof traits?.name === "string") return traits.name;
  if (typeof traits?.email === "string") return traits.email;
  return identity.id.slice(0, 8);
}

function getEmail(identity: Identity): string | undefined {
  const traits = identity.traits as Record<string, unknown>;
  return typeof traits?.email === "string" ? traits.email : undefined;
}

function stateBadgeVariant(state: string): Parameters<typeof Badge>[0]["variant"] {
  return state === "active" ? "approved" : "closed";
}

function verificationBadge(addr: VerifiableAddress): Parameters<typeof Badge>[0]["variant"] {
  if (addr.verified) return "verified";
  if (addr.status === "pending") return "draft";
  return "closed";
}

/* ------------------------------------------------------------------ */
/* Schema label extraction                                             */
/* ------------------------------------------------------------------ */

function extractTraitLabels(schema: IdentitySchema["schema"]): Map<string, string> {
  const labels = new Map<string, string>();
  const traits = (schema as Record<string, unknown>)?.properties as
    | Record<string, unknown>
    | undefined;
  const traitProps = traits?.traits as Record<string, unknown> | undefined;
  const props = traitProps?.properties as Record<string, Record<string, unknown>> | undefined;

  if (props) {
    for (const [key, def] of Object.entries(props)) {
      const title = typeof def?.title === "string" ? def.title : key;
      labels.set(key, title);
    }
  }
  return labels;
}

/* ------------------------------------------------------------------ */
/* Structured read-only value renderer                                 */
/* ------------------------------------------------------------------ */

function StructuredValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) {
    return <span className={traitValueEmpty}>—</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span className={css({ display: "inline-flex", alignItems: "center", gap: "6px" })}>
        <Icon name={value ? "check_circle" : "cancel"} size={16} />
        {value ? "Yes" : "No"}
      </span>
    );
  }

  if (typeof value === "string" || typeof value === "number") {
    return <span className={traitValue}>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className={traitValueEmpty}>Empty list</span>;
    return (
      <div className={css({ display: "flex", flexDirection: "column", gap: "4px" })}>
        {value.map((item, i) => (
          <div key={i} className={css({ display: "flex", alignItems: "baseline", gap: "8px" })}>
            <span className={css({ fontSize: "xs", color: "text.tertiary" })}>•</span>
            <StructuredValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (entries.length === 0) return <span className={traitValueEmpty}>Empty object</span>;

    return (
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          paddingLeft: depth > 0 ? "12px" : "0",
          borderLeft: depth > 0 ? "1px solid" : "none",
          borderColor: depth > 0 ? "border.subtle" : "transparent",
        })}
      >
        {entries.map(([k, v]) => (
          <div key={k} className={css({ display: "flex", flexDirection: "column", gap: "2px" })}>
            <span
              className={css({
                fontSize: "xs",
                fontWeight: "semibold",
                color: "text.tertiary",
                textTransform: "capitalize",
              })}
            >
              {k}
            </span>
            <StructuredValue value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  return <span className={traitValue}>{String(value)}</span>;
}

/* ------------------------------------------------------------------ */
/* TextArea — beam-ui does not provide one yet                         */
/* ------------------------------------------------------------------ */

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={formField}>
      <label className={formLabel}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className={textareaStyle}
      />
    </div>
  );
}

const textareaStyle = css({
  width: "100%",
  padding: "10px 12px",
  backgroundColor: "bg.card",
  border: "1px solid",
  borderColor: "border.default",
  borderRadius: "0",
  fontSize: "14px",
  fontFamily: "body",
  color: "text.primary",
  outline: "none",
  resize: "vertical",
  minHeight: "80px",
  transition: "all 0.15s ease",
  _focus: {
    ringWidth: "2px",
    ringColor: "sunbeam.orange",
    borderColor: "transparent",
  },
  _placeholder: {
    color: "text.muted",
  },
});

/* ------------------------------------------------------------------ */
/* Editable value — recursive form renderer                            */
/* ------------------------------------------------------------------ */

function isFlatObject(value: unknown): value is Record<string, string | number | boolean | null> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (v) => v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean",
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function EditableValue({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  // Null / undefined → empty text input
  if (value === null || value === undefined) {
    return (
      <TextInput
        label={label}
        value=""
        onChange={(v) => onChange(v)}
      />
    );
  }

  // Boolean
  if (typeof value === "boolean") {
    return (
      <Checkbox
        label={label}
        checked={value}
        onChange={(checked) => onChange(checked)}
      />
    );
  }

  // Number
  if (typeof value === "number") {
    return (
      <TextInput
        type="number"
        label={label}
        value={String(value)}
        onChange={(v) => {
          const n = Number(v);
          onChange(Number.isNaN(n) ? v : n);
        }}
      />
    );
  }

  // Long string → textarea
  if (typeof value === "string" && value.length > 80) {
    return (
      <TextAreaField
        label={label}
        value={value}
        onChange={(v) => onChange(v)}
      />
    );
  }

  // Short string
  if (typeof value === "string") {
    return (
      <TextInput
        label={label}
        value={value}
        onChange={(v) => onChange(v)}
      />
    );
  }

  // Array of strings → tags input
  if (isStringArray(value)) {
    return (
      <TagsInput
        label={label}
        value={value}
        onChange={(next) => onChange(next)}
      />
    );
  }

  // Flat object → nested fields
  if (isFlatObject(value)) {
    return (
      <div className={css({ display: "flex", flexDirection: "column", gap: "12px" })}>
        <span className={formLabel}>{label}</span>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "12px",
            borderRadius: "md",
            border: "1px solid",
            borderColor: "border.subtle",
            backgroundColor: "bg.surface",
          })}
        >
          {Object.entries(value).map(([k, v]) => (
            <EditableValue
              key={k}
              label={k}
              value={v}
              onChange={(newVal) => onChange({ ...value, [k]: newVal })}
            />
          ))}
        </div>
      </div>
    );
  }

  // Fallback for deeply nested structures
  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "4px" })}>
      <span className={formLabel}>{label}</span>
      <div className={css({ padding: "12px", borderRadius: "md", backgroundColor: "bg.subtle" })}>
        <StructuredValue value={value} />
      </div>
      <p className={css({ fontSize: "xs", color: "text.muted" })}>
        Complex nested values can only be edited via the API.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editable traits panel                                               */
/* ------------------------------------------------------------------ */

function EditableTraitsPanel({
  traits,
  labels,
  onChange,
}: {
  traits: Record<string, unknown>;
  labels: Map<string, string>;
  onChange: (traits: Record<string, unknown>) => void;
}) {
  const entries = Object.entries(traits);
  if (entries.length === 0) {
    return <p className={mutedText}>No traits defined.</p>;
  }

  return (
    <div className={formGrid}>
      {entries.map(([key, value]) => {
        const label = labels.get(key) ?? key;
        const isLongText = typeof value === "string" && value.length > 80;
        const isPrimitive =
          value === null ||
          value === undefined ||
          typeof value === "boolean" ||
          typeof value === "string" ||
          typeof value === "number";
        const isSimple = isPrimitive || isFlatObject(value) || isStringArray(value);
        const span = isLongText || !isPrimitive ? formFieldFull : formField;

        return (
          <div key={key} className={span}>
            <EditableValue
              label={label}
              value={value}
              onChange={(newVal) => onChange({ ...traits, [key]: newVal })}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editable metadata panel                                             */
/* ------------------------------------------------------------------ */

function EditableMetadataPanel({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className={mutedText}>No metadata.</p>;
  }

  return (
    <div className={formGrid}>
      {entries.map(([key, value]) => {
        const label = key.replace(/_/g, " ");
        const isLongText = typeof value === "string" && value.length > 80;
        const isPrimitive =
          value === null ||
          value === undefined ||
          typeof value === "boolean" ||
          typeof value === "string" ||
          typeof value === "number";
        const isSimple = isPrimitive || isFlatObject(value) || isStringArray(value);
        const span = isLongText || !isPrimitive ? formFieldFull : formField;

        return (
          <div key={key} className={span}>
            <EditableValue
              label={label}
              value={value}
              onChange={(newVal) => onChange({ ...data, [key]: newVal })}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only panels (kept for view mode)                               */
/* ------------------------------------------------------------------ */

function TraitsPanel({
  traits,
  schema,
}: {
  traits: Record<string, unknown>;
  schema?: IdentitySchema["schema"];
}) {
  const labels = schema ? extractTraitLabels(schema) : new Map<string, string>();
  const entries = Object.entries(traits);

  if (entries.length === 0) {
    return <p className={mutedText}>No traits defined for this identity.</p>;
  }

  return (
    <div className={traitsGrid}>
      {entries.map(([key, value]) => (
        <div key={key} className={traitCard}>
          <span className={traitLabelStyle}>{labels.get(key) ?? key}</span>
          <StructuredValue value={value} />
        </div>
      ))}
    </div>
  );
}

function AddressesPanel({ identity }: { identity: Identity }) {
  return (
    <div className={sectionStack}>
      <section>
        <h3 className={sectionTitle}>Verifiable Addresses</h3>
        {identity.verifiable_addresses && identity.verifiable_addresses.length > 0 ? (
          <div className={addressList}>
            {identity.verifiable_addresses.map((addr) => (
              <div key={addr.id} className={addressCard}>
                <div className={addressHeader}>
                  <span className={addressValue}>{addr.value}</span>
                  <Badge variant={verificationBadge(addr)}>
                    {addr.verified ? "Verified" : addr.status}
                  </Badge>
                </div>
                <div className={addressMeta}>
                  <span>Via: {addr.via}</span>
                  {addr.verified_at && <span>Verified at: {formatDate(addr.verified_at)}</span>}
                  {addr.created_at && <span>Created: {formatDate(addr.created_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={mutedText}>No verifiable addresses.</p>
        )}
      </section>

      <section>
        <h3 className={sectionTitle}>Recovery Addresses</h3>
        {identity.recovery_addresses && identity.recovery_addresses.length > 0 ? (
          <div className={addressList}>
            {identity.recovery_addresses.map((addr) => (
              <div key={addr.id} className={addressCard}>
                <div className={addressHeader}>
                  <span className={addressValue}>{addr.value}</span>
                  <span className={addressVia}>{addr.via}</span>
                </div>
                <div className={addressMeta}>
                  {addr.created_at && <span>Created: {formatDate(addr.created_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={mutedText}>No recovery addresses.</p>
        )}
      </section>
    </div>
  );
}

function MetadataPanel({ identity }: { identity: Identity }) {
  const hasPublic = identity.metadata_public && Object.keys(identity.metadata_public).length > 0;
  const hasAdmin = identity.metadata_admin && Object.keys(identity.metadata_admin).length > 0;

  if (!hasPublic && !hasAdmin) {
    return <p className={mutedText}>No metadata set for this identity.</p>;
  }

  return (
    <div className={sectionStack}>
      {hasPublic && (
        <section>
          <h3 className={sectionTitle}>Public Metadata</h3>
          <div className={structuredGrid}>
            {Object.entries(identity.metadata_public!).map(([key, value]) => (
              <div key={key} className={structuredCard}>
                <span className={structuredLabel}>{key}</span>
                <StructuredValue value={value} />
              </div>
            ))}
          </div>
        </section>
      )}
      {hasAdmin && (
        <section>
          <h3 className={sectionTitle}>Admin Metadata</h3>
          <div className={structuredGrid}>
            {Object.entries(identity.metadata_admin!).map(([key, value]) => (
              <div key={key} className={structuredCard}>
                <span className={structuredLabel}>{key}</span>
                <StructuredValue value={value} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OverviewPanel({ identity }: { identity: Identity }) {
  return (
    <div className={overviewGrid}>
      <InfoField label="ID" value={identity.id} monospace copyable />
      <InfoField label="Schema ID" value={identity.schema_id} />
      <InfoField
        label="Schema URL"
        value={
          <a href={identity.schema_url} target="_blank" rel="noreferrer" className={linkStyle}>
            {identity.schema_url}
          </a>
        }
      />
      <InfoField
        label="State"
        value={<Badge variant={stateBadgeVariant(identity.state)}>{identity.state}</Badge>}
      />
      {identity.organization_id && (
        <InfoField label="Organization" value={identity.organization_id} />
      )}
      <InfoField label="Created" value={formatDate(identity.created_at)} />
      <InfoField label="Updated" value={formatDate(identity.updated_at)} />
      {identity.state_changed_at && (
        <InfoField label="State Changed" value={formatDate(identity.state_changed_at)} />
      )}
    </div>
  );
}

function InfoField({
  label,
  value,
  monospace,
  copyable,
}: {
  label: string;
  value: React.ReactNode;
  monospace?: boolean;
  copyable?: boolean;
}) {
  const text = typeof value === "string" ? value : "";
  return (
    <div className={infoField}>
      <span className={infoLabel}>{label}</span>
      <div className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
        <span className={monospace ? infoValueMono : infoValue}>{value}</span>
        {copyable && text && (
          <button
            type="button"
            className={iconBtn}
            onClick={() => navigator.clipboard.writeText(text)}
            title="Copy to clipboard"
            aria-label={`Copy ${label}`}
          >
            <Icon name="content_copy" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dummy data                                                          */
/* ------------------------------------------------------------------ */

const DUMMY_IDENTITY: Identity = {
  id: "emp_7f3a9d2e-1b5c-4e8f-a6d3-9c2e1f4a8b5d",
  schema_id: "employee",
  schema_url: "https://schemas.sunbeam.studio/employee.json",
  state: "active",
  state_changed_at: "2026-05-15T09:30:00.000Z",
  traits: {
    email: "sienna@sunbeam.pt",
    given_name: "Sienna",
    family_name: "Vasquez",
    middle_name: "Marie",
    nickname: "sie",
    picture: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop",
    phone_number: "+351 912 345 678",
    job_title: "Founder & CTO",
    department: "Engineering",
    office_location: "Lisbon, Portugal",
  },
  verifiable_addresses: [
    {
      id: "addr_1a2b3c4d",
      value: "sienna@sunbeam.pt",
      verified: true,
      via: "email",
      status: "completed",
      verified_at: "2026-05-10T14:22:00.000Z",
      created_at: "2026-05-01T10:00:00.000Z",
      updated_at: "2026-05-10T14:22:00.000Z",
    },
    {
      id: "addr_5e6f7g8h",
      value: "sienna.vasquez@personal.com",
      verified: false,
      via: "email",
      status: "pending",
      created_at: "2026-05-18T11:30:00.000Z",
      updated_at: "2026-05-18T11:30:00.000Z",
    },
  ],
  recovery_addresses: [
    {
      id: "rec_9i0j1k2l",
      value: "sienna@sunbeam.pt",
      via: "email",
      created_at: "2026-05-01T10:00:00.000Z",
      updated_at: "2026-05-01T10:00:00.000Z",
    },
  ],
  metadata_public: {
    pronouns: "she/her",
    timezone: "Europe/Lisbon",
    preferred_language: "en",
    bio: "Building the future of creative infrastructure. Obsessed with distributed systems, design, and making technology invisible.",
    social: {
      github: "sienna-v",
      bluesky: "@sienna.sunbeam.pt",
    },
  },
  metadata_admin: {
    onboarding_completed: true,
    onboarding_date: "2026-05-01",
    access_level: "admin",
    teams: ["engineering", "design", "leadership"],
    reports_to: null,
    employee_id: "SB-001",
    cost_center: "CC-ENG-001",
  },
  organization_id: "org_sunbeam_studios",
  created_at: "2026-05-01T10:00:00.000Z",
  updated_at: "2026-05-20T16:45:00.000Z",
};

const DUMMY_SCHEMA: IdentitySchema = {
  id: "employee",
  schema: {
    $id: "https://schemas.sunbeam.studio/employee.json",
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Employee",
    type: "object",
    properties: {
      traits: {
        type: "object",
        properties: {
          email: { type: "string", format: "email", title: "Email" },
          given_name: { type: "string", title: "First name" },
          family_name: { type: "string", title: "Last name" },
          middle_name: { type: "string", title: "Middle name" },
          nickname: { type: "string", title: "Nickname" },
          picture: { type: "string", format: "uri", title: "Profile picture" },
          phone_number: { type: "string", title: "Phone number" },
          job_title: { type: "string", title: "Job title" },
          department: { type: "string", title: "Department" },
          office_location: { type: "string", title: "Office location" },
        },
        required: ["email"],
        additionalProperties: false,
      },
    },
  },
};

const USE_DUMMY_DATA = import.meta.env.DEV;

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export function IdentityDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/identities/$id" });
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);

  /* Toast state */
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" | "info"; visible: boolean }>({
    message: "",
    variant: "info",
    visible: false,
  });

  /* Draft states for editing */
  const [draftTraits, setDraftTraits] = useState<Record<string, unknown>>({});
  const [draftMetadataPublic, setDraftMetadataPublic] = useState<Record<string, unknown> | null>(null);
  const [draftMetadataAdmin, setDraftMetadataAdmin] = useState<Record<string, unknown> | null>(null);
  const [draftState, setDraftState] = useState<"active" | "inactive">("active");

  const query = useRestQuery<Identity>(api, `/identities/${id}`, {
    queryKey: ["identity", id],
    enabled: Boolean(id) && !USE_DUMMY_DATA,
  });

  const schemaQuery = useRestQuery<IdentitySchema>(
    api,
    `/schemas/${query.data?.schema_id ?? ""}`,
    {
      queryKey: ["schema", query.data?.schema_id],
      enabled: Boolean(query.data?.schema_id) && !USE_DUMMY_DATA,
    },
  );

  const updateIdentity = useRestMutation<Identity, UpdateIdentity>(
    api,
    "PUT",
    `/identities/${id}`,
  );

  const deleteIdentity = useRestMutation<unknown, unknown>(api, "DELETE", `/identities/${id}`);

  const identity = USE_DUMMY_DATA ? DUMMY_IDENTITY : query.data;
  const schema = USE_DUMMY_DATA ? DUMMY_SCHEMA.schema : schemaQuery.data?.schema;
  const labels = schema ? extractTraitLabels(schema) : new Map<string, string>();

  const enterEditMode = useCallback(() => {
    if (!identity) return;
    setDraftTraits({ ...identity.traits });
    setDraftMetadataPublic(identity.metadata_public ? { ...identity.metadata_public } : null);
    setDraftMetadataAdmin(identity.metadata_admin ? { ...identity.metadata_admin } : null);
    setDraftState(identity.state);
    setIsEditing(true);
  }, [identity]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const showToast = useCallback((message: string, variant: "success" | "error" | "info" = "info") => {
    setToast({ message, variant, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  /* Show toast on mutation errors */
  useEffect(() => {
    if (updateIdentity.error) {
      showToast(`Save failed: ${formatErrorMessage(updateIdentity.error)}`, "error");
    }
  }, [updateIdentity.error, showToast]);

  useEffect(() => {
    if (deleteIdentity.error) {
      showToast(`Delete failed: ${formatErrorMessage(deleteIdentity.error)}`, "error");
    }
  }, [deleteIdentity.error, showToast]);

  const saveEdit = useCallback(() => {
    if (!identity) return;
    const payload: UpdateIdentity = {
      schema_id: identity.schema_id,
      state: draftState,
      traits: draftTraits,
      metadata_public: draftMetadataPublic,
      metadata_admin: draftMetadataAdmin,
    };
    updateIdentity.mutate(payload, {
      onSuccess: () => {
        setIsEditing(false);
        query.refetch();
        showToast("Identity saved successfully", "success");
      },
    });
  }, [identity, draftState, draftTraits, draftMetadataPublic, draftMetadataAdmin, updateIdentity, query, showToast]);

  return (
    <div className={container}>
      {query.isLoading && !USE_DUMMY_DATA && <p className={statusText}>Loading identity…</p>}
      {query.error && !USE_DUMMY_DATA && <p className={errorText}>Error: {query.error.message}</p>}

      {identity && (
        <>
          {/* Header */}
          <div className={header}>
            <div>
              <div className={css({ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" })}>
                <h1 className={title}>{getDisplayName(identity)}</h1>
                <Badge variant={stateBadgeVariant(identity.state)}>{identity.state}</Badge>
              </div>
              {getEmail(identity) && (
                <p className={subtitle}>{getEmail(identity)}</p>
              )}
            </div>
            <div className={headerActions}>
              <Link to="/identities" className={ghostLink}>
                <Icon name="arrow_back" size={16} />
                Back
              </Link>

              {isEditing ? (
                <>
                  <Button variant="ghost" onClick={cancelEdit}>
                    <Icon name="close" size={16} />
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={saveEdit}
                    disabled={updateIdentity.isPending}
                  >
                    <Icon name="save" size={16} />
                    {updateIdentity.isPending ? "Saving…" : "Save"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={enterEditMode}>
                    <Icon name="edit" size={16} />
                    Edit
                  </Button>
                  <Button
                    variant="dark"
                    className={css({ backgroundColor: "error", _hover: { opacity: 0.9 } })}
                    onClick={() => {
                      if (confirm("Delete this identity? This action cannot be undone.")) {
                        deleteIdentity.mutate(undefined, {
                          onSuccess: () => {
                            navigate({ to: "/identities" });
                          },
                        });
                      }
                    }}
                    disabled={deleteIdentity.isPending}
                  >
                    <Icon name="delete" size={16} />
                    {deleteIdentity.isPending ? "Deleting…" : "Delete"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Toast */}
          <Toast
            message={toast.message}
            variant={toast.variant}
            visible={toast.visible}
            onDismiss={hideToast}
          />

          {/* Tabs */}
          <Tabs
            items={[
              { value: "overview", label: "Overview" },
              { value: "traits", label: "Traits" },
              { value: "addresses", label: "Addresses" },
              { value: "metadata", label: "Metadata" },
            ]}
            activeValue={activeTab}
            onChange={setActiveTab}
          />

          {/* Tab content */}
          <ScrollArea maxHeight="calc(100vh - 220px)" className={tabContent}>
            <div className={tabPanelPadding}>
              {activeTab === "overview" && (
                <>
                  {isEditing ? (
                    <div className={overviewGrid}>
                      <InfoField label="ID" value={identity.id} monospace copyable />
                      <InfoField label="Schema ID" value={identity.schema_id} />
                      <InfoField label="Created" value={formatDate(identity.created_at)} />
                      <InfoField label="Updated" value={formatDate(identity.updated_at)} />
                      <div className={infoField}>
                        <span className={infoLabel}>State</span>
                        <div className={css({ display: "flex", alignItems: "center", gap: "12px" })}>
                          <label className={css({ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" })}>
                            <input
                              type="radio"
                              name="state"
                              checked={draftState === "active"}
                              onChange={() => setDraftState("active")}
                              className={formRadio}
                            />
                            <Badge variant="approved">active</Badge>
                          </label>
                          <label className={css({ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" })}>
                            <input
                              type="radio"
                              name="state"
                              checked={draftState === "inactive"}
                              onChange={() => setDraftState("inactive")}
                              className={formRadio}
                            />
                            <Badge variant="closed">inactive</Badge>
                          </label>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <OverviewPanel identity={identity} />
                  )}
                </>
              )}

              {activeTab === "traits" && (
                <>
                  {isEditing ? (
                    <EditableTraitsPanel
                      traits={draftTraits}
                      labels={labels}
                      onChange={setDraftTraits}
                    />
                  ) : (
                    <TraitsPanel traits={identity.traits} schema={schema} />
                  )}
                </>
              )}

              {activeTab === "addresses" && <AddressesPanel identity={identity} />}

              {activeTab === "metadata" && (
                <>
                  {isEditing ? (
                    <div className={sectionStack}>
                      {identity.metadata_public && (
                        <section>
                          <h3 className={sectionTitle}>Public Metadata</h3>
                          <EditableMetadataPanel
                            data={draftMetadataPublic ?? {}}
                            onChange={setDraftMetadataPublic}
                          />
                        </section>
                      )}
                      {identity.metadata_admin && (
                        <section>
                          <h3 className={sectionTitle}>Admin Metadata</h3>
                          <EditableMetadataPanel
                            data={draftMetadataAdmin ?? {}}
                            onChange={setDraftMetadataAdmin}
                          />
                        </section>
                      )}
                    </div>
                  ) : (
                    <MetadataPanel identity={identity} />
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const container = css({
  padding: "24px",
  maxWidth: "1200px",
  margin: "0 auto",
});

const header = css({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  marginBottom: "24px",
  gap: "16px",
  flexWrap: "wrap",
});

const title = css({
  fontSize: "xl",
  fontWeight: "bold",
  color: "text.primary",
});

const subtitle = css({
  fontSize: "sm",
  color: "text.secondary",
});

const headerActions = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
});

const statusText = css({
  color: "text.secondary",
});

const errorText = css({
  color: "error",
  fontSize: "sm",
});

const tabContent = css({
  marginTop: "-16px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.subtle",
  backgroundColor: "bg.surface",
});

const tabPanelPadding = css({
  paddingTop: "24px",
  paddingRight: "24px",
  paddingBottom: "64px",
  paddingLeft: "24px",
});

/* Overview */

const overviewGrid = css({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "16px",
  maxWidth: "640px",
});

const infoField = css({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "12px 16px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.subtle",
  backgroundColor: "bg.surface",
});

const infoLabel = css({
  fontSize: "xs",
  fontWeight: "semibold",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "text.tertiary",
});

const infoValue = css({
  fontSize: "sm",
  color: "text.primary",
  wordBreak: "break-all",
});

const infoValueMono = css({
  fontSize: "sm",
  color: "text.primary",
  fontFamily: "mono",
  wordBreak: "break-all",
});

const linkStyle = css({
  fontSize: "sm",
  color: "accent",
  textDecoration: "none",
  _hover: { textDecoration: "underline" },
});

const iconBtn = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  borderRadius: "md",
  border: "none",
  backgroundColor: "transparent",
  color: "text.secondary",
  cursor: "pointer",
  transition: "all 0.15s",
  _hover: {
    color: "text.primary",
    backgroundColor: "bg.hover",
  },
});

/* Traits */

const traitsGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "16px",
});

const traitCard = css({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  padding: "16px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.subtle",
  backgroundColor: "bg.surface",
});

const traitLabelStyle = css({
  fontSize: "xs",
  fontWeight: "semibold",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "text.tertiary",
});

const traitValue = css({
  fontSize: "sm",
  color: "text.primary",
  wordBreak: "break-word",
});

const traitValueEmpty = css({
  fontSize: "sm",
  color: "text.muted",
  fontStyle: "italic",
});

/* Addresses */

const sectionStack = css({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
});

const sectionTitle = css({
  fontSize: "sm",
  fontWeight: "semibold",
  color: "text.primary",
  marginBottom: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
});

const addressList = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
});

const addressCard = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "16px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.subtle",
  backgroundColor: "bg.surface",
});

const addressHeader = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
});

const addressValue = css({
  fontSize: "sm",
  fontWeight: "medium",
  color: "text.primary",
  wordBreak: "break-all",
});

const addressVia = css({
  fontSize: "xs",
  color: "text.secondary",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
});

const addressMeta = css({
  display: "flex",
  gap: "16px",
  fontSize: "xs",
  color: "text.secondary",
  flexWrap: "wrap",
});

const mutedText = css({
  fontSize: "sm",
  color: "text.muted",
  fontStyle: "italic",
});

/* Structured data */

const structuredGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: "12px",
});

const structuredCard = css({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "12px 16px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.subtle",
  backgroundColor: "bg.surface",
});

const structuredLabel = css({
  fontSize: "xs",
  fontWeight: "semibold",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "text.tertiary",
});

/* Form styles */

const formGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "16px",
  maxWidth: "720px",
});

const formField = css({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});

const formFieldFull = css({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  gridColumn: "1 / -1",
});

const formLabel = css({
  fontSize: "12px",
  fontWeight: "button",
  color: "text.primary",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
});

const formRadio = css({
  width: "16px",
  height: "16px",
  accentColor: "sunbeam.orange",
  cursor: "pointer",
});

/* Action buttons */

const ghostLink = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.default",
  backgroundColor: "transparent",
  color: "text.secondary",
  fontSize: "13px",
  fontWeight: "button",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  cursor: "pointer",
  textDecoration: "none",
  transition: "all 0.15s",
  _hover: {
    color: "text.primary",
    backgroundColor: "bg.hover",
  },
});


