import {
  Alert,
  Badge,
  Button,
  Divider,
  Flex,
  Group,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";

const INDEXES = ["logs", "metrics", "traces"] as const;
const TIME_RANGES = ["1h", "24h", "7d", "30d"] as const;

const INDEX_LABELS: Record<(typeof INDEXES)[number], string> = {
  logs: "Logs",
  metrics: "Metrics",
  traces: "Traces",
};

const TIME_RANGE_LABELS: Record<(typeof TIME_RANGES)[number], string> = {
  "1h": "Last hour",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

// The form's live validator (`validators.onChange` below): every field on
// screen, all optional except `query`, which every action needs. This is the
// intersection of what Search and Save both require — it must never block
// either button. Search/save each layer their own requirements on top via
// `.required()` rather than restating shape rules (email/length/regex).
const baseSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Enter a search query")
    .max(200, "Keep it under 200 characters"),
  name: z
    .string()
    .trim()
    .min(1, "Required")
    .max(100, "Keep it under 100 characters")
    .optional(),
  index: z.enum(INDEXES, { error: "Choose an index" }).optional(),
  timeRange: z.enum(TIME_RANGES, { error: "Choose a time range" }).optional(),
  description: z
    .string()
    .max(500, "Keep it under 500 characters")
    .optional(),
  from: z.iso.date({ error: "Choose a start date" }).optional(),
  to: z.iso.date({ error: "Choose an end date" }).optional(),
  owner: z
    .string()
    .trim()
    .min(1, "Required")
    .max(100, "Keep it under 100 characters")
    .optional(),
});

type FormValues = z.infer<typeof baseSchema>;

const searchSchema = baseSchema.required({ index: true, timeRange: true });

const saveSchema = baseSchema
  .required({ name: true, from: true, to: true, owner: true })
  .refine((v) => v.from <= v.to, {
    message: "From must be on or before To",
    path: ["to"],
  });

const EMPTY_VALUES: FormValues = { query: "" };

type SubmitIntent = { intent: "search" | "save" };

type SearchResult = {
  id: number;
  title: string;
  index: (typeof INDEXES)[number];
  timeRange: (typeof TIME_RANGES)[number];
};

type SavedSearch = {
  id: number;
  name: string;
  query: string;
  description?: string;
  from: string;
  to: string;
  owner: string;
};

// A fixed catalog the mock "search" filters against — stands in for a real
// backend call so the example stays self-contained.
const RESULT_CATALOG: Omit<SearchResult, "id">[] = [
  { title: "payment-service timeout spike", index: "logs", timeRange: "1h" },
  { title: "checkout latency p99 regression", index: "metrics", timeRange: "24h" },
  { title: "auth-service 5xx errors", index: "logs", timeRange: "24h" },
  { title: "cart-service trace gaps", index: "traces", timeRange: "7d" },
  { title: "db connection pool exhaustion", index: "metrics", timeRange: "7d" },
  { title: "checkout latency p99 baseline", index: "metrics", timeRange: "30d" },
];

// `field.state.meta.errors` holds Standard Schema issues (objects with
// `.message`), not plain strings — this repo's zod skill covers why.
function firstErrorMessage(errors: ReadonlyArray<unknown>): string | undefined {
  const [issue] = errors;
  if (issue == null) return undefined;
  return typeof issue === "string" ? issue : (issue as { message: string }).message;
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

// Neither branch wants the other's fields — project down to what each
// endpoint actually needs rather than forwarding the whole values blob.
function toSearchPayload(v: z.infer<typeof searchSchema>) {
  return { query: v.query, index: v.index, timeRange: v.timeRange };
}

function toSavePayload(v: z.infer<typeof saveSchema>) {
  return {
    name: v.name,
    query: v.query,
    description: v.description,
    from: v.from,
    to: v.to,
    owner: v.owner,
  };
}

export function MultiActionSearchFormExample() {
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [nextResultId, setNextResultId] = useState(1);
  const [nextSavedId, setNextSavedId] = useState(1);

  const form = useForm({
    defaultValues: EMPTY_VALUES,
    onSubmitMeta: { intent: "search" } as SubmitIntent,
    // The floor — the intersection of both actions' needs. Blocks neither
    // button; action-specific requiredness is enforced below, per branch.
    validators: { onChange: baseSchema },
    onSubmit: async ({ value, meta }) => {
      // Clear stale errors from the other branch's previous failed attempt —
      // otherwise a failed Save leaves "Owner is required" on screen after a
      // subsequent successful Search.
      form.setErrorMap({ onSubmit: undefined });

      if (meta.intent === "save") {
        const result = saveSchema.safeParse(value);
        if (!result.success) {
          form.setErrorMap({ onSubmit: { fields: toFieldErrors(result.error) } });
          return;
        }
        const payload = toSavePayload(result.data);
        setSavedSearches((prev) => [...prev, { ...payload, id: nextSavedId }]);
        setNextSavedId((id) => id + 1);
        form.reset();
        return;
      }

      const result = searchSchema.safeParse(value);
      if (!result.success) {
        form.setErrorMap({ onSubmit: { fields: toFieldErrors(result.error) } });
        return;
      }
      const payload = toSearchPayload(result.data);
      const matches = RESULT_CATALOG.filter(
        (r) =>
          r.index === payload.index &&
          r.timeRange === payload.timeRange &&
          r.title.toLowerCase().includes(payload.query.toLowerCase()),
      );
      setResults(
        matches.map((match, i) => ({ ...match, id: nextResultId + i })),
      );
      setNextResultId((id) => id + matches.length);
    },
  });

  return (
    <Flex direction="column" gap="lg" p="lg" h="100%" style={{ overflow: "auto" }}>
      <Text fw={600} size="lg">
        Saved Search
      </Text>

      <Flex gap="xl" wrap="wrap" align="flex-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{ width: 360 }}
        >
          <Stack gap="sm">
            <form.Field name="query">
              {(field) => (
                <TextInput
                  label="Query"
                  placeholder="e.g. timeout"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                />
              )}
            </form.Field>

            <form.Field name="name">
              {(field) => (
                <TextInput
                  label="Search name"
                  placeholder="Only needed to save"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                />
              )}
            </form.Field>

            <Divider label="Search options" labelPosition="left" mt="xs" />

            <form.Field name="index">
              {(field) => (
                <Select
                  label="Index"
                  placeholder="Choose one"
                  data={INDEXES.map((value) => ({
                    value,
                    label: INDEX_LABELS[value],
                  }))}
                  value={field.state.value ?? null}
                  onChange={(value) =>
                    field.handleChange(
                      (value ?? undefined) as FormValues["index"],
                    )
                  }
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                />
              )}
            </form.Field>

            <form.Field name="timeRange">
              {(field) => (
                <Select
                  label="Time range"
                  placeholder="Choose one"
                  data={TIME_RANGES.map((value) => ({
                    value,
                    label: TIME_RANGE_LABELS[value],
                  }))}
                  value={field.state.value ?? null}
                  onChange={(value) =>
                    field.handleChange(
                      (value ?? undefined) as FormValues["timeRange"],
                    )
                  }
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                />
              )}
            </form.Field>

            <Divider label="Save this search" labelPosition="left" mt="xs" />

            <form.Field name="description">
              {(field) => (
                <Textarea
                  label="Description"
                  placeholder="Optional"
                  autosize
                  minRows={2}
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                />
              )}
            </form.Field>

            <Group grow>
              <form.Field name="from">
                {(field) => (
                  <DateInput
                    label="From"
                    value={field.state.value ?? null}
                    onChange={(value) => field.handleChange(value ?? undefined)}
                    onBlur={field.handleBlur}
                    error={firstErrorMessage(field.state.meta.errors)}
                    clearable
                  />
                )}
              </form.Field>

              <form.Field name="to">
                {(field) => (
                  <DateInput
                    label="To"
                    value={field.state.value ?? null}
                    onChange={(value) => field.handleChange(value ?? undefined)}
                    onBlur={field.handleBlur}
                    error={firstErrorMessage(field.state.meta.errors)}
                    clearable
                  />
                )}
              </form.Field>
            </Group>

            <form.Field name="owner">
              {(field) => (
                <TextInput
                  label="Owner"
                  placeholder="Only needed to save"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                />
              )}
            </form.Field>

            <Group justify="flex-end" mt="sm">
              <Button variant="default" type="button" onClick={() => form.reset()}>
                Reset
              </Button>
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting] as const}
              >
                {([canSubmit, isSubmitting]) => (
                  <>
                    <Button
                      type="button"
                      variant="light"
                      loading={isSubmitting}
                      disabled={!canSubmit}
                      onClick={() => form.handleSubmit({ intent: "search" })}
                    >
                      Search
                    </Button>
                    <Button
                      type="button"
                      loading={isSubmitting}
                      disabled={!canSubmit}
                      onClick={() => form.handleSubmit({ intent: "save" })}
                    >
                      Save search
                    </Button>
                  </>
                )}
              </form.Subscribe>
            </Group>
          </Stack>
        </form>

        <Stack gap="xl" style={{ flex: 1, minWidth: 320 }}>
          <Stack gap="xs">
            <Text fw={600} size="sm" c="dimmed">
              Results
            </Text>
            {results === null ? (
              <Alert variant="light" color="gray">
                Fill in Query, Index and Time range, then Search.
              </Alert>
            ) : results.length === 0 ? (
              <Alert variant="light" color="gray">
                No results for that query.
              </Alert>
            ) : (
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Title</Table.Th>
                    <Table.Th>Index</Table.Th>
                    <Table.Th>Time range</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {results.map((result) => (
                    <Table.Tr key={result.id}>
                      <Table.Td>{result.title}</Table.Td>
                      <Table.Td>
                        <Badge variant="light">{INDEX_LABELS[result.index]}</Badge>
                      </Table.Td>
                      <Table.Td>{TIME_RANGE_LABELS[result.timeRange]}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>

          <Stack gap="xs">
            <Text fw={600} size="sm" c="dimmed">
              Saved searches
            </Text>
            {savedSearches.length === 0 ? (
              <Alert variant="light" color="gray">
                Fill in Query, Search name, From, To and Owner, then Save search.
              </Alert>
            ) : (
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Query</Table.Th>
                    <Table.Th>From</Table.Th>
                    <Table.Th>To</Table.Th>
                    <Table.Th>Owner</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {savedSearches.map((saved) => (
                    <Table.Tr key={saved.id}>
                      <Table.Td>{saved.name}</Table.Td>
                      <Table.Td>{saved.query}</Table.Td>
                      <Table.Td>{saved.from}</Table.Td>
                      <Table.Td>{saved.to}</Table.Td>
                      <Table.Td>{saved.owner}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
}
