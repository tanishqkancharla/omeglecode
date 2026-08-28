import {
  Badge,
  Flex,
  H1,
  H2,
  Label,
  P,
  Padding,
  Panel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  monospace,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { pollMs, type CostResult, type CostWindow, type LiveData } from "./data.js";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return "< $0.01";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${formatCount(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024)
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatMicroseconds(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} s`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} ms`;
  return `${formatCount(value)} µs`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function deltaLabel(current: number, baseline: number): string {
  const delta = Math.max(0, current - baseline);
  if (delta === 0) return "no change since this page opened";
  return `+${formatCount(delta)} since this page opened`;
}

function Mono(props: {
  children: string;
  size?: "sm" | "md" | "lg" | "xl";
  color?: "highContrast" | "lowContrast" | "accent";
}) {
  const className = useStyles(
    text(props.size ?? "md", 600, props.color ?? "highContrast"),
    monospace,
  );
  return <span className={className}>{props.children}</span>;
}

function Page(props: { children: ReactNode }) {
  const className = useStyles(
    style({
      maxWidth: "880px",
      marginInline: "auto",
      minHeight: "100vh",
    }),
  );
  return (
    <div className={className}>
      <Padding xy={8}>{props.children}</Padding>
    </div>
  );
}

function StatGrid(props: { children: ReactNode }) {
  const className = useStyles(
    style({
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: spacing.value(4),
    }),
  );
  return <div className={className}>{props.children}</div>;
}

const numericCell = style({ textAlign: "right" });

function NumberCell(props: { children: string }) {
  const className = useStyles(numericCell);
  return (
    <TableCell align="middle">
      <div className={className}>
        <Mono size="sm">{props.children}</Mono>
      </div>
    </TableCell>
  );
}

function HeaderNumber(props: { children: string }) {
  const className = useStyles(numericCell);
  return (
    <TableHeaderCell>
      <div className={className}>{props.children}</div>
    </TableHeaderCell>
  );
}

export function App() {
  const [data, setData] = useState<LiveData>();
  const [error, setError] = useState<string>();
  const baseline = useRef<{ joins: number; messages: number } | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/live/data");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = (await response.json()) as LiveData;
        if (cancelled) return;
        if (!baseline.current) {
          baseline.current = { joins: next.joins, messages: next.messages };
        }
        setData(next);
        setError(undefined);
      } catch {
        if (!cancelled) setError("Could not load live stats.");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const rooms = Object.entries(data?.rooms ?? {}).sort(
    ([leftLabel, left], [rightLabel, right]) =>
      right.joins - left.joins || leftLabel.localeCompare(rightLabel),
  );

  return (
    <Page>
      <Flex column gap={8}>
        <Flex column gap={2}>
          <H1>Omeglecode live</H1>
          <P>
            Joins are lifetime successful WebSocket connects (HTTP 101), not
            unique people and not currently online. Reconnects count again.
            Messages are delivered chat lines stored in room history.
          </P>
        </Flex>

        {error ? <P>{error}</P> : null}
        {!data && !error ? <P>Loading…</P> : null}

        {data ? (
          <>
            <StatGrid>
              <Panel>
                <Flex column gap={2}>
                  <Label>Joins</Label>
                  <Mono size="xl">{formatCount(data.joins)}</Mono>
                  <P>
                    {deltaLabel(
                      data.joins,
                      baseline.current?.joins ?? data.joins,
                    )}
                  </P>
                </Flex>
              </Panel>
              <Panel>
                <Flex column gap={2}>
                  <Label>Messages</Label>
                  <Mono size="xl">{formatCount(data.messages)}</Mono>
                  <P>
                    {deltaLabel(
                      data.messages,
                      baseline.current?.messages ?? data.messages,
                    )}
                  </P>
                </Flex>
              </Panel>
            </StatGrid>

            <CostSection cost={data.cost} />

            <Panel>
              <Flex column gap={4}>
                <H2>Rooms</H2>
                {rooms.length === 0 ? (
                  <P>No rooms with joins or messages yet.</P>
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Room</TableHeaderCell>
                        <HeaderNumber>Joins</HeaderNumber>
                        <HeaderNumber>Messages</HeaderNumber>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rooms.map(([label, room]) => (
                        <TableRow key={label}>
                          <TableCell align="middle">
                            <Mono size="sm">{label}</Mono>
                          </TableCell>
                          <NumberCell>{formatCount(room.joins)}</NumberCell>
                          <NumberCell>
                            {formatCount(room.messages)}
                          </NumberCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Flex>
            </Panel>

            <P>{`Updated ${formatWhen(data.updatedAt)}. Polls every 8 seconds.`}</P>
          </>
        ) : null}
      </Flex>
    </Page>
  );
}

function CostSection(props: { cost: CostResult }) {
  const cost = props.cost;
  return (
    <Panel>
      <Flex column gap={4}>
        <Flex row gap={3} alignItems="center">
          <H2>Durable Object cost</H2>
          <Badge>estimate</Badge>
        </Flex>
          {cost.available ? (
            <>
              <P>
                {`Workers Paid plan rates for ${cost.scriptName} (${cost.classes.join(" + ")}). Month-to-date subtracts included allotments (1M requests, 400k GB-s, 5 GB-month) and rounds billable requests and duration up to the next million, matching Cloudflare’s billing examples. Last 24 hours is usage only, with no monthly included allotment applied. Estimates, not invoices.`}
              </P>
              <CostTable last24h={cost.last24h} monthToDate={cost.monthToDate} />
              <P>
                {`Invocations: ${cost.units.invocations}. Wall time: ${cost.units.wallTime}. Incoming WebSocket messages are billed at 20:1 and added to invocations for the request estimate.`}
              </P>
            </>
          ) : (
            <P>{cost.reason}</P>
          )}
        </Flex>
      </Panel>
  );
}

function CostTable(props: { last24h: CostWindow; monthToDate: CostWindow }) {
  const rows: { label: string; last24h: string; month: string }[] = [
    {
      label: "Estimated USD",
      last24h: formatUsd(props.last24h.estimatedUsd),
      month: formatUsd(props.monthToDate.estimatedUsd),
    },
    {
      label: "Invocations",
      last24h: formatCount(props.last24h.usage.invocations),
      month: formatCount(props.monthToDate.usage.invocations),
    },
    {
      label: "Billed request units",
      last24h: formatCount(props.last24h.billedRequestUnits),
      month: formatCount(props.monthToDate.billedRequestUnits),
    },
    {
      label: "Wall time",
      last24h: formatMicroseconds(props.last24h.usage.wallTime),
      month: formatMicroseconds(props.monthToDate.usage.wallTime),
    },
    {
      label: "Duration (GB-s)",
      last24h: props.last24h.gbSeconds.toFixed(2),
      month: props.monthToDate.gbSeconds.toFixed(2),
    },
    {
      label: "CPU time",
      last24h: formatMicroseconds(props.last24h.usage.cpuTime),
      month: formatMicroseconds(props.monthToDate.usage.cpuTime),
    },
    {
      label: "Incoming WebSocket messages",
      last24h: formatCount(props.last24h.usage.incomingWebsocketMessages),
      month: formatCount(props.monthToDate.usage.incomingWebsocketMessages),
    },
    {
      label: "Outgoing WebSocket messages",
      last24h: formatCount(props.last24h.usage.outboundWebsocketMessages),
      month: formatCount(props.monthToDate.usage.outboundWebsocketMessages),
    },
    {
      label: "Stored data",
      last24h: formatBytes(props.last24h.usage.storedBytes),
      month: formatBytes(props.monthToDate.usage.storedBytes),
    },
  ];

  return (
    <Flex column gap={3}>
      <Flex row gap={8}>
        <Flex column gap={1}>
          <Label>Last 24 hours</Label>
          <P>{`${formatWhen(props.last24h.since)} → ${formatWhen(props.last24h.until)}`}</P>
        </Flex>
        <Flex column gap={1}>
          <Label>Month to date (UTC)</Label>
          <P>{`${formatWhen(props.monthToDate.since)} → ${formatWhen(props.monthToDate.until)}`}</P>
        </Flex>
      </Flex>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Meter</TableHeaderCell>
            <HeaderNumber>Last 24h</HeaderNumber>
            <HeaderNumber>Month to date</HeaderNumber>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell align="middle">{row.label}</TableCell>
              <NumberCell>{row.last24h}</NumberCell>
              <NumberCell>{row.month}</NumberCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Flex>
  );
}
