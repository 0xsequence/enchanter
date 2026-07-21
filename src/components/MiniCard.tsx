import { Box, Progress, SimpleGrid, Tooltip } from "@mantine/core";
import { ReactElement, ReactNode } from "react";
import { notifications } from "@mantine/notifications";
import { IconCopy, IconEye } from "@tabler/icons-react";

export function CardGrid(props: { children: ReactNode }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" mb="md">
      {props.children}
    </SimpleGrid>
  );
}

export function MiniCard(args: {
  title: string;
  value: ReactElement | string;
  shortValue?: string;
  progress?: number;
}) {
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
  };

  return (
    <Box className="mini-card">
      <div className="mini-card-label">
        {args.title}
        <div className="mini-card-tools">
          {args.shortValue && (
            <Tooltip
              label={
                <div
                  style={{
                    maxWidth: "800px",
                    whiteSpace: "normal",
                    wordWrap: "break-word",
                  }}
                >
                  {args.value}
                </div>
              }
            >
              <IconEye cursor="pointer" size="1rem" stroke={1.5} />
            </Tooltip>
          )}
          {typeof args.value === "string" && (
            <IconCopy
              cursor="pointer"
              onClick={copyContent}
              size="1rem"
              stroke={1.5}
            />
          )}
        </div>
      </div>
      <div className="mini-card-value">{args.shortValue || args.value}</div>
      {args.progress !== undefined && (
        <Progress
          value={Math.min(args.progress, 100)}
          size={4}
          mt={10}
          color={args.progress >= 100 ? "green.6" : "polPurple.6"}
        />
      )}
    </Box>
  );
}
