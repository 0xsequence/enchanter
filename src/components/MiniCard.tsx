import { Box } from "@mantine/core";
import { ReactElement } from "react";
import { notifications } from "@mantine/notifications";
import { IconCopy } from '@tabler/icons-react';

export function MiniCard(args: { title: string, value: ReactElement | string, shortValue?: string }) {
  const copyContent = async () => {
    if (typeof args.value === "string") {
      try {
        await navigator.clipboard.writeText(args.value);
        notifications.show({
          title: `${args.title} copied`,
          message: `${args.title} successfully copied to clipboard`,
          color: "green",
        });
      } catch (error) {
        notifications.show({
          title: "Failed to copy text",
          message: JSON.stringify(error),
          color: "red",
        });
      }
    }
  }

  return (
    <Box style={{
      border: "1px solid #f0f0f0",
      borderRadius: 4,
      padding: 16,
      marginBottom: 16,
      marginLeft: 8,
      marginRight: 8
    }}>
      <div style={{
        fontSize: 12,
        color: "#666",
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between"
      }}>{args.title}{args.shortValue && <IconCopy cursor="pointer" onClick={copyContent} size="1rem" stroke={1.5} />}</div>
      <div style={{
        fontWeight: 600,
        color: "#333"
      }}>{args.shortValue || args.value}</div>
    </Box>
  )
}
