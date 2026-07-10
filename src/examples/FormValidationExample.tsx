import {
  Alert,
  Badge,
  Button,
  Flex,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";

const DEPARTMENTS = [
  "Engineering",
  "Design",
  "Product",
  "Sales",
  "HR",
] as const;

// Field-level validators below reuse `employeeFormSchema.shape.<field>` so the
// per-keystroke checks and the final submit gate can never drift apart — one
// schema, two places it's read from.
const employeeFormSchema = z.object({
  name: z.string().trim().min(2, "Enter a full name"),
  email: z.email("Enter a valid email address"),
  department: z.enum(DEPARTMENTS, { error: "Choose a department" }),
  role: z.string().trim().min(2, "Enter a role"),
  salary: z
    .number({ error: "Enter a salary" })
    .min(20_000, "Salary must be at least 20,000 SEK")
    .max(500_000, "That salary looks too high"),
  // DateInput's onChange hands back an ISO date string (not a Date), so the
  // schema validates that shape directly rather than coercing to Date.
  startDate: z
    .iso.date({ error: "Choose a start date" })
    .refine((value) => new Date(value) <= new Date(), {
      message: "Start date can't be in the future",
    }),
});

// The in-progress form shape, before validation — looser than the schema's
// output type since Mantine inputs report "empty" as "", null, etc.
type EmployeeFormValues = {
  name: string;
  email: string;
  department: (typeof DEPARTMENTS)[number] | null;
  role: string;
  salary: number | "";
  startDate: string | null;
};

const EMPTY_VALUES: EmployeeFormValues = {
  name: "",
  email: "",
  department: null,
  role: "",
  salary: "",
  startDate: null,
};

type SubmittedEmployee = z.infer<typeof employeeFormSchema> & { id: number };

// `field.state.meta.errors` holds Standard Schema issues (objects with
// `.message`), not plain strings — this repo's zod skill covers why.
function firstErrorMessage(errors: ReadonlyArray<unknown>): string | undefined {
  const [issue] = errors;
  if (issue == null) return undefined;
  return typeof issue === "string" ? issue : (issue as { message: string }).message;
}

export function FormValidationExample() {
  const [submitted, setSubmitted] = useState<SubmittedEmployee[]>([]);
  const [nextId, setNextId] = useState(1);

  const form = useForm({
    defaultValues: EMPTY_VALUES,
    // The authoritative gate: runs the whole object on every submit attempt,
    // so a field the user never touched still blocks submission and shows
    // its error (field-level validators alone would miss it — see the
    // tanstack-form skill's "validate on submit, not just onChange" note).
    validators: { onSubmit: employeeFormSchema },
    onSubmit: ({ value }) => {
      const employee = employeeFormSchema.parse(value);
      setSubmitted((prev) => [...prev, { ...employee, id: nextId }]);
      setNextId((id) => id + 1);
      form.reset();
    },
  });

  return (
    <Flex direction="column" gap="lg" p="lg" h="100%" style={{ overflow: "auto" }}>
      <Text fw={600} size="lg">
        New Employee
      </Text>

      <Flex gap="xl" wrap="wrap" align="flex-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          style={{ width: 360 }}
        >
          <Stack gap="sm">
            <form.Field
              name="name"
              validators={{ onChange: employeeFormSchema.shape.name }}
            >
              {(field) => (
                <TextInput
                  label="Name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                />
              )}
            </form.Field>

            <form.Field
              name="email"
              validators={{ onChange: employeeFormSchema.shape.email }}
            >
              {(field) => (
                <TextInput
                  label="Email"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                />
              )}
            </form.Field>

            <form.Field
              name="department"
              validators={{ onChange: employeeFormSchema.shape.department }}
            >
              {(field) => (
                <Select
                  label="Department"
                  placeholder="Choose one"
                  data={[...DEPARTMENTS]}
                  value={field.state.value}
                  onChange={(value) =>
                    field.handleChange(value as EmployeeFormValues["department"])
                  }
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                />
              )}
            </form.Field>

            <form.Field
              name="role"
              validators={{ onChange: employeeFormSchema.shape.role }}
            >
              {(field) => (
                <TextInput
                  label="Role"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                />
              )}
            </form.Field>

            <form.Field
              name="salary"
              validators={{ onChange: employeeFormSchema.shape.salary }}
            >
              {(field) => (
                <NumberInput
                  label="Salary (SEK)"
                  value={field.state.value}
                  onChange={(value) =>
                    field.handleChange(value === "" ? "" : Number(value))
                  }
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                />
              )}
            </form.Field>

            <form.Field
              name="startDate"
              validators={{ onChange: employeeFormSchema.shape.startDate }}
            >
              {(field) => (
                <DateInput
                  label="Start date"
                  value={field.state.value}
                  onChange={(value) => field.handleChange(value)}
                  onBlur={field.handleBlur}
                  error={firstErrorMessage(field.state.meta.errors)}
                  clearable
                />
              )}
            </form.Field>

            <Group justify="flex-end" mt="sm">
              <Button
                variant="default"
                type="button"
                onClick={() => form.reset()}
              >
                Reset
              </Button>
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting] as const}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button type="submit" loading={isSubmitting} disabled={!canSubmit}>
                    Add employee
                  </Button>
                )}
              </form.Subscribe>
            </Group>
          </Stack>
        </form>

        <Stack gap="xs" style={{ flex: 1, minWidth: 320 }}>
          <Text fw={600} size="sm" c="dimmed">
            Submitted
          </Text>
          {submitted.length === 0 ? (
            <Alert variant="light" color="gray">
              Fill in the form and submit — validated entries land here.
            </Alert>
          ) : (
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Department</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Salary</Table.Th>
                  <Table.Th>Start</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {submitted.map((employee) => (
                  <Table.Tr key={employee.id}>
                    <Table.Td>{employee.name}</Table.Td>
                    <Table.Td>
                      <Badge variant="light">{employee.department}</Badge>
                    </Table.Td>
                    <Table.Td>{employee.role}</Table.Td>
                    <Table.Td>
                      {employee.salary.toLocaleString("sv-SE", {
                        style: "currency",
                        currency: "SEK",
                        maximumFractionDigits: 0,
                      })}
                    </Table.Td>
                    <Table.Td>{employee.startDate}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Flex>
    </Flex>
  );
}
