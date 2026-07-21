import { Box, Group, Text, Title } from "@mantine/core";
import { ReactNode } from "react";

export function Page(props: { children: ReactNode }) {
  return (
    <Box maw={1120} mx="auto">
      {props.children}
    </Box>
  );
}

export function PageHeader(props: {
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Box mb="xl">
      <Group justify="space-between" align="flex-end" gap="md">
        <Box>
          <Title order={3}>{props.title}</Title>
          {props.description && (
            <Text fz="sm" c="dimmed" mt={6} maw={620}>
              {props.description}
            </Text>
          )}
          {props.meta && (
            <Text ff="monospace" fz={13} c="var(--text-body)" mt={8} style={{ lineBreak: "anywhere" }}>
              {props.meta}
            </Text>
          )}
        </Box>
        {props.actions && <Group gap="sm">{props.actions}</Group>}
      </Group>
    </Box>
  );
}

export function SectionTitle(props: { children: ReactNode; order?: 4 | 5 }) {
  return (
    <Title order={props.order ?? 5} mt="xl" mb="md">
      {props.children}
    </Title>
  );
}

// Single-level surface: white card on the gray canvas. Never nest panels.
export function Panel(props: { children: ReactNode; padded?: boolean }) {
  return (
    <Box className={props.padded ? "panel panel-padded" : "panel"}>
      {props.children}
    </Box>
  );
}

export function EmptyState(props: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box className="empty-state">
      {props.icon && <Box className="empty-state-icon">{props.icon}</Box>}
      <Text fz="sm" fw={500} c="var(--text-primary)">
        {props.title}
      </Text>
      {props.description && (
        <Text fz="sm" c="dimmed" mt={4} maw={420} mx="auto">
          {props.description}
        </Text>
      )}
      {props.action && <Box mt="md">{props.action}</Box>}
    </Box>
  );
}
