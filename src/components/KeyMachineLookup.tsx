import { Button, Loader } from "@mantine/core";
import { IconFileSearch, IconRefresh } from "@tabler/icons-react";
import { EmptyState } from "./Page";
import { KeyMachineLookupStatus } from "../stores/KeyMachine";

export function KeyMachineLookup(props: {
  title: string;
  status: KeyMachineLookupStatus;
  retry: () => void;
}) {
  if (props.status === "idle" || props.status === "searching") {
    return (
      <EmptyState
        icon={<Loader size="1.2rem" />}
        title="Checking the Key Machine…"
        description="This record is not stored locally. Looking it up on the Sequence Key Machine."
      />
    );
  }

  return (
    <EmptyState
      icon={<IconFileSearch size="1.2rem" stroke={1.5} />}
      title={props.title}
      description={
        props.status === "error"
          ? "The Key Machine lookup failed. Check your connection and try again, or import the data manually."
          : "Not found locally or on the Sequence Key Machine. Try importing data."
      }
      action={
        <Button
          variant="default"
          size="xs"
          leftSection={<IconRefresh size={14} stroke={1.5} />}
          onClick={props.retry}
        >
          Check again
        </Button>
      }
    />
  );
}
