import {
  Box,
  type BoxProps,
  Checkbox,
  type CheckboxProps,
  Flex,
  Loader,
  Text,
} from "@mantine/core";
import {
  type Cell,
  flexRender,
  type Row,
  type RowData,
  type Table as TanstackTableDef,
} from "@tanstack/react-table";
import {
  type CSSProperties,
  type PropsWithChildren,
  type RefObject,
  type UIEvent,
  useRef,
  useState,
} from "react";
import classes from "./TMTable2.module.css";

// Same invariance workaround as TMTable — see TMTable.tsx for explanation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFeatures = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTableFeaturesRecord = Record<string, any>;

function RoundedCornerWrapper(p: PropsWithChildren<BoxProps>) {
  return (
    <Box className={classes.wrapper} {...p}>
      {p.children}
    </Box>
  );
}

function TableComponent<T extends RowData, TF extends AnyTableFeaturesRecord = AnyFeatures>({
  table: tableArg,
  loading,
  noResultsLabel = "Inga resultat matchar din sökning",
  scrollContainerRef: externalRef,
  children,
}: PropsWithChildren<{
  table: TanstackTableDef<TF, T>;
  loading?: boolean;
  noResultsLabel?: string;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = tableArg as TanstackTableDef<AnyFeatures, T>;

  // Left-pinned → center → right-pinned matches getHeaderGroups/getVisibleCells order.
  const orderedColumns = [
    ...table.getLeftLeafColumns(),
    ...table.getCenterLeafColumns(),
    ...table.getRightLeafColumns(),
  ];
  const gridTemplateColumns = orderedColumns
    .map((col) =>
      col.columnDef.minSize === col.columnDef.maxSize
        ? `${col.getSize()}px`
        : `minmax(${col.columnDef.minSize || 0}px, ${col.columnDef.meta?.flex ?? 1}fr)`,
    )
    .join(" ");

  const internalRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = externalRef ?? internalRef;
  const [scrolledLeft, setScrolledLeft] = useState(false);
  const [scrolledRight, setScrolledRight] = useState(false);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, scrollWidth, clientWidth } = e.currentTarget;
    setScrolledLeft(scrollLeft > 0);
    setScrolledRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  const noData = table.getRowModel().rows.length === 0;

  return (
    <div
      ref={scrollContainerRef}
      className={classes.scrollContainer}
      onScroll={handleScroll}
    >
      <div
        role="table"
        className={classes.grid}
        style={{
          gridTemplateColumns,
          minWidth: table.getTotalSize(),
        }}
      >
        {children}

        {loading === true && noData && (
          <div
            role="row"
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "center",
              padding: "32px",
            }}
          >
            <Loader size="lg" />
          </div>
        )}
        {loading === false && noData && (
          <div
            role="row"
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
              padding: "32px",
            }}
          >
            <Text fz="3em" component="i" className="fal fa-magnifying-glass" />
            <Text fz="lg">{noResultsLabel}</Text>
          </div>
        )}
      </div>

      {/* Scroll position indicators — only visual, not interactive */}
      {(scrolledLeft || scrolledRight) && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: [
              scrolledLeft
                ? "linear-gradient(to right, rgba(0,0,0,0.07) 0px, transparent 20px)"
                : "",
              scrolledRight
                ? "linear-gradient(to left, rgba(0,0,0,0.07) 0px, transparent 20px)"
                : "",
            ]
              .filter(Boolean)
              .join(", "),
          }}
        />
      )}
    </div>
  );
}

function THead<T extends RowData, TF extends AnyTableFeaturesRecord = AnyFeatures>({
  table: tableArg,
}: {
  table: TanstackTableDef<TF, T>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = tableArg as TanstackTableDef<AnyFeatures, T>;
  const leftLeafCols = table.getLeftLeafColumns();
  const rightLeafCols = table.getRightLeafColumns();
  return (
    <div role="rowgroup" style={{ display: "contents" }}>
      {table.getHeaderGroups().map((headerGroup) => (
        <div key={headerGroup.id} role="row" className={classes.headerRow}>
          {headerGroup.headers.map((header) => {
            const isPinned = header.column.getIsPinned();
            const isLastLeft =
              isPinned === "left" && leftLeafCols.at(-1)?.id === header.column.id;
            const isFirstRight =
              isPinned === "right" && rightLeafCols[0]?.id === header.column.id;

            const cellClass = [
              classes.headerCell,
              header.column.getCanSort() ? classes.headerCellSortable : "",
              isLastLeft ? classes.stickyLeft : "",
              isFirstRight ? classes.stickyRight : "",
            ]
              .filter(Boolean)
              .join(" ");

            const sortOrder = header.column.getIsSorted();

            return (
              <div
                key={header.id}
                role="columnheader"
                data-testid={header.column.id ? "col-header-" + header.column.id : ""}
                className={cellClass}
                title={
                  header.column.getCanSort()
                    ? header.column.getNextSortingOrder() === "asc"
                      ? "Sortera stigande"
                      : header.column.getNextSortingOrder() === "desc"
                        ? "Sortera fallande"
                        : "Ta bort sortering"
                    : undefined
                }
                onClick={header.column.getToggleSortingHandler()}
                style={{
                  left:
                    isPinned === "left"
                      ? `${header.column.getStart("left")}px`
                      : undefined,
                  right:
                    isPinned === "right"
                      ? `${header.column.getAfter("right")}px`
                      : undefined,
                  position: isPinned ? "sticky" : undefined,
                  zIndex: isPinned ? 4 : undefined,
                }}
              >
                {header.isPlaceholder ? null : (
                  <Flex justify="space-between" align="center" w="100%">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && sortOrder && (
                      <i
                        className={`sort-icon fa-thin fa-chevron-${sortOrder === "asc" ? "up" : "down"}`}
                        style={{ marginLeft: 4, flexShrink: 0 }}
                      />
                    )}
                  </Flex>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function TBody({ children }: PropsWithChildren) {
  return (
    <div role="rowgroup" style={{ display: "contents" }}>
      {children}
    </div>
  );
}

function TBodyRow<T extends RowData, TF extends AnyTableFeaturesRecord = AnyFeatures>({
  row: rowArg,
  mih,
}: {
  row: Row<TF, T>;
  mih?: CSSProperties["minHeight"];
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = rowArg as Row<AnyFeatures, T>;
  return (
    <div role="row" className={classes.bodyRow} style={{ minHeight: mih }}>
      {row.getVisibleCells().map((cell) => (
        <TBodyCell key={cell.id} cell={cell} mih={mih} />
      ))}
    </div>
  );
}

function TBodyCell<T extends RowData>({
  cell,
  mih,
}: {
  cell: Cell<AnyFeatures, T>;
  mih?: CSSProperties["minHeight"];
}) {
  const isPinned = cell.column.getIsPinned();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = cell.getContext().table as TanstackTableDef<AnyFeatures, T>;
  const leftLeafCols = table.getLeftLeafColumns();
  const rightLeafCols = table.getRightLeafColumns();
  const isLastLeft =
    isPinned === "left" && leftLeafCols.at(-1)?.id === cell.column.id;
  const isFirstRight =
    isPinned === "right" && rightLeafCols[0]?.id === cell.column.id;

  return (
    <div
      role="cell"
      className={[
        classes.bodyCell,
        isLastLeft ? classes.stickyLeft : "",
        isFirstRight ? classes.stickyRight : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        minHeight: mih,
        left:
          isPinned === "left" ? `${cell.column.getStart("left")}px` : undefined,
        right:
          isPinned === "right"
            ? `${cell.column.getAfter("right")}px`
            : undefined,
        position: isPinned ? "sticky" : undefined,
        zIndex: isPinned ? 2 : undefined,
      }}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </div>
  );
}

function SelectAllCheckbox<T extends RowData, TF extends AnyTableFeaturesRecord = AnyFeatures>({
  table: tableArg,
  ...checkboxProps
}: { table: TanstackTableDef<TF, T> } & CheckboxProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = tableArg as TanstackTableDef<AnyFeatures, T>;
  return (
    <Checkbox
      checked={table.getIsAllRowsSelected()}
      indeterminate={table.getIsSomeRowsSelected()}
      onChange={table.getToggleAllRowsSelectedHandler()}
      {...checkboxProps}
    />
  );
}

function SelectRowCheckbox<T extends RowData, TF extends AnyTableFeaturesRecord = AnyFeatures>({
  row: rowArg,
  ...checkboxProps
}: { row: Row<TF, T> } & CheckboxProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = rowArg as Row<AnyFeatures, T>;
  return (
    <Checkbox
      checked={row.getIsSelected()}
      disabled={!row.getCanSelect()}
      indeterminate={row.getIsSomeSelected()}
      onChange={row.getToggleSelectedHandler()}
      {...checkboxProps}
    />
  );
}

export const TMTable2 = {
  RoundedCornerWrapper,
  Table: TableComponent,
  THead,
  TBody,
  TBodyRow,
  SelectAllCheckbox,
  SelectRowCheckbox,
};
