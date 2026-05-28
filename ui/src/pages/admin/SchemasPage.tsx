import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, TextInput, Select, Callout, Spinner, CodeEditor } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

const panel = css({
  border: "1.5px solid",
  borderColor: "border.default",
  borderRadius: "0",
  padding: "16px",
  bg: "bg.surface",
});

const sectionEyebrow = css({
  fontSize: "10px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "text.muted",
  marginBottom: "4px",
});

const LOCALE_OPTIONS = [
  { value: "pt-PT", label: "pt-PT" },
  { value: "en-GB", label: "en-GB" },
  { value: "es-ES", label: "es-ES" },
];

type Schema = {
  id: string;
  blob?: string;
};

type SchemaBlob = {
  properties?: {
    traits?: {
      properties?: Record<string, { type?: string; title?: string; enum?: string[] }>;
    };
  };
};

const FALLBACK_SCHEMA = JSON.stringify(
  {
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
            "ory.sh/kratos": {
              credentials: { password: { identifier: true }, webauthn: { identifier: true }, totp: { account_name: true } },
              verification: { via: "email" },
              recovery: { via: "email" },
            },
          },
          name: {
            type: "object",
            properties: {
              first: { type: "string", title: "First name" },
              last: { type: "string", title: "Last name" },
            },
          },
          locale: { type: "string", enum: ["pt-PT", "en-GB", "es-ES"] },
          organization_id: { type: "string", format: "uuid" },
        },
        required: ["email"],
      },
    },
  },
  null,
  2
);

function extractTraitFields(raw: string): Array<{ key: string; title: string; type: string; isEnum: boolean; options: string[] }> {
  try {
    const parsed: SchemaBlob = JSON.parse(raw);
    const props = parsed?.properties?.traits?.properties ?? {};
    return Object.entries(props).map(([key, val]) => ({
      key,
      title: val.title ?? key,
      type: val.type ?? "string",
      isEnum: Array.isArray(val.enum),
      options: (val.enum ?? []).map(String),
    }));
  } catch {
    return [];
  }
}

export function SchemasPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState<string>(FALLBACK_SCHEMA);
  const [validateMsg, setValidateMsg] = useState<string | null>(null);

  const { data: schemas, isLoading: loadingList, error: listError } = useQuery({
    queryKey: ["schemas"],
    queryFn: () => api.get<Schema[]>("/schemas"),
  });

  useEffect(() => {
    if (schemas && schemas.length > 0 && !selectedId) {
      setSelectedId(schemas[0].id);
    }
  }, [schemas]);

  const { data: schemaDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["schema", selectedId],
    queryFn: () => api.get<{ blob: string }>(`/schemas/${encodeURIComponent(selectedId!)}`),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (schemaDetail?.blob) {
      try {
        const decoded = atob(schemaDetail.blob);
        setEditorValue(JSON.stringify(JSON.parse(decoded), null, 2));
      } catch {
        setEditorValue(schemaDetail.blob);
      }
    }
  }, [schemaDetail]);

  function handleValidate() {
    try {
      JSON.parse(editorValue);
      setValidateMsg("✓ Valid JSON");
    } catch (e) {
      setValidateMsg("✗ Invalid JSON: " + (e as Error).message);
    }
  }

  const traitFields = extractTraitFields(editorValue);

  return (
    <div className={css({ padding: "28px" })}>
      {/* Page header */}
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" })}>
        <div>
          <h1 className={css({ fontSize: "24px", fontWeight: 700, color: "text.primary", fontFamily: "heading", marginBottom: "4px" })}>
            Identity Schemas
          </h1>
          <div className={css({ fontSize: "12px", color: "text.muted" })}>
            JSON Schema definitions for identity traits.
          </div>
        </div>
        <Button variant="primary">+ New schema</Button>
      </div>

      {listError && (
        <Callout variant="warning">
          {listError instanceof Error ? listError.message : "Failed to load schemas"}
        </Callout>
      )}

      {validateMsg && (
        <Callout variant={validateMsg.startsWith("✓") ? "tip" : "warning"}>
          {validateMsg}
        </Callout>
      )}

      <div className={css({ display: "grid", gridTemplateColumns: "260px 1fr 280px", gap: "16px", alignItems: "start" })}>
        {/* Schema list */}
        <div className={panel}>
          <div className={sectionEyebrow}>
            Schemas ({loadingList ? "…" : (schemas?.length ?? 0)})
          </div>
          {loadingList ? (
            <Spinner size="md" />
          ) : (
            <div className={css({ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" })}>
              {(schemas ?? []).map((s) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(s.id)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedId(s.id)}
                  className={css({
                    padding: "8px 10px",
                    cursor: "pointer",
                    borderRadius: "0",
                    border: "1.5px solid",
                    borderColor: selectedId === s.id ? "sunbeam.orange" : "transparent",
                    bg: selectedId === s.id ? "bg.page" : "transparent",
                    _hover: { bg: "bg.page" },
                  })}
                >
                  <div className={css({ fontWeight: 600, fontSize: "12px", color: "text.primary" })}>{s.id}</div>
                </div>
              ))}
              {(!schemas || schemas.length === 0) && (
                <div className={css({ fontSize: "11px", color: "text.muted" })}>No schemas found.</div>
              )}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className={panel}>
          <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" })}>
            <div>
              <div className={sectionEyebrow}>JSON Schema · {selectedId ?? "none selected"}</div>
              <div className={css({ fontSize: "14px", fontWeight: 600, color: "text.primary" })}>Editor</div>
            </div>
            <div className={css({ display: "flex", gap: "6px" })}>
              <Button onClick={handleValidate}>Validate</Button>
              <Button>Diff vs v2</Button>
            </div>
          </div>
          {loadingDetail ? (
            <div className={css({ display: "flex", justifyContent: "center", padding: "48px" })}>
              <Spinner size="md" />
            </div>
          ) : (
            <CodeEditor
              value={editorValue}
              onChange={(v) => setEditorValue(v ?? "")}
              language="json"
            />
          )}
        </div>

        {/* Live preview */}
        <div className={panel}>
          <div className={sectionEyebrow}>Live preview</div>
          <div className={css({ fontSize: "14px", fontWeight: 600, color: "text.primary", marginBottom: "12px" })}>
            Form rendering
          </div>
          <div className={css({ display: "flex", flexDirection: "column", gap: "10px" })}>
            {traitFields.length === 0 ? (
              <>
                <TextInput label="E-Mail" placeholder="you@studio.pt" value="" onChange={() => {}} />
                <TextInput label="First name" placeholder="Joana" value="" onChange={() => {}} />
                <TextInput label="Last name" placeholder="Silva" value="" onChange={() => {}} />
                <Select options={LOCALE_OPTIONS} value="" onChange={() => {}} placeholder="Select locale" />
              </>
            ) : (
              traitFields.map((f) =>
                f.isEnum ? (
                  <Select
                    key={f.key}
                    options={f.options.map((o) => ({ value: o, label: o }))}
                    value=""
                    onChange={() => {}}
                    placeholder={`Select ${f.title}`}
                  />
                ) : (
                  <TextInput key={f.key} label={f.title} placeholder={f.title} value="" onChange={() => {}} />
                )
              )
            )}
          </div>
          <div className={css({ marginTop: "10px", padding: "8px", bg: "bg.page", border: "1px dashed", borderColor: "border.subtle", fontSize: "10px", color: "text.muted" })}>
            preview uses ory_kratos_continuity
          </div>
        </div>
      </div>
    </div>
  );
}
