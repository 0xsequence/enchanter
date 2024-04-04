import { Box } from "@mantine/core";
import { ReactElement } from "react";

export function MiniCard(args: { title: string, value: ReactElement | string }) {
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
        color: "#666"
      }}>{args.title}</div>
      <div style={{
        fontWeight: 600,
        color: "#333"
      }}>{args.value}</div>
    </Box>
  )
}
