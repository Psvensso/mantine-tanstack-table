import {
  ActionIcon,
  Box,
  type BoxProps,
  Checkbox,
  type CheckboxProps,
  Flex,
  Loader,
  Pagination,
  Select,
  Table,
  type TableTrProps,
  Text,
} from "@mantine/core";
import {
  type Cell,
  type Column,
  flexRender,
  type Row,
  type RowData,
  type Table as TanstackTableDef,
} from "@tanstack/react-table";
import {
  type ComponentProps,
  type CSSProperties,
  type PropsWithChildren,
  type ReactNode,
  type UIEvent,
  useRef,
  useState,
} from "react";
import classes from "./TMTable.module.css";

// TanStack Table v9 uses invariant `in out TFeatures`, so Table<FeatA, T> is never
// assignable to Table<FeatB, T> — even when FeatB is a structural subset of FeatA.
// `AnyFeatures = any` lets IsAny<TFeatures> inside ExtractFeatureMapTypes resolve
// to expose all feature methods inside TMTable components.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFeatures = any;

// Structural constraint that every concrete `tableFeatures({...})` result satisfies.
// Used as the upper bound for the generic TF parameters below so TypeScript infers
// the table type at each call site rather than checking assignability against any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTableFeaturesRecord = Record<string, any>;

function commonPinningStyles<T extends RowData>(
  column: Column<AnyFeatures, T>,
  table: TanstackTableDef<AnyFeatures, T>,
): { style: CSSProperties; className?: string } {
  const isPinned = column.getIsPinned();
  const leftLeafCols = table.getLeftLeafColumns();
  const rightLeafCols = table.getRightLeafColumns();
  const isLastLeftPinnedColumn =
    isPinned === "left" && leftLeafCols.at(-1)?.id === column.id;
  const isFirstRightPinnedColumn =
    isPinned === "right" && rightLeafCols[0]?.id === column.id;

  const isSticky = isLastLeftPinnedColumn || isFirstRightPinnedColumn;
  let className = isSticky ? classes.tmTableStickyColumn : undefined;
  if (isLastLeftPinnedColumn) {
    className = `${className} ${classes.tmTableStickyLeft}`;
  } else if (isFirstRightPinnedColumn) {
    className = `${className} ${classes.tmTableStickyRight}`;
  }

  return {
    className,
    style: {
      left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
      right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
      backgroundColor: "var(--mantine-color-body)",
      position: isPinned ? "sticky" : "relative",
      zIndex: isPinned ? 1 : 0,
      overflow: "visible",
      borderBottom: "1px solid var(--mantine-color-default-border)",
    },
  };
}

function RoundedCornerWrapper(p: PropsWithChildren<BoxProps>) {
  return (
    <Box className={classes.tmTableWrapper} {...p}>
      {p.children}
    </Box>
  );
}

function TableComponent<T extends RowData, TF extends AnyTableFeaturesRecord = AnyFeatures>({
  loading,
  noResultsLabel = "Inga resultat matchar din sökning",
  table: tableArg,
  ...rest
}: PropsWithChildren<
  ComponentProps<typeof Table> & {
    loading?: boolean;
    noResultsLabel?: string;
    table: TanstackTableDef<TF, T>;
  }
>) {
  // Cast once: TF is inferred at the call site (no assignability check against any),
  // then widened here so all feature methods are accessible inside the component.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = tableArg as TanstackTableDef<AnyFeatures, T>;
  // Must match the render order from getHeaderGroups/getVisibleCells:
  // left-pinned → center → right-pinned (not plain getVisibleLeafColumns which uses definition order).
  const orderedColumns = [
    ...table.getLeftLeafColumns(),
    ...table.getCenterLeafColumns(),
    ...table.getRightLeafColumns(),
  ];
  const gridTemplateColumns = orderedColumns
    .map((col) => {
      return col.columnDef.minSize === col.columnDef.maxSize
        ? `${col.getSize()}px`
        : `minmax(${col.columnDef.minSize || 0}px, ${col.columnDef.meta?.flex ?? 1}fr)`;
    })
    .join(" ");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrolledLeft, setScrolledLeft] = useState(false);
  const [scrolledRight, setScrolledRight] = useState(false);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setScrolledLeft(scrollLeft > 0);
    setScrolledRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  const containerClassName = [
    classes.tmTableScrollContainer,
    scrolledLeft ? classes.tmTableScrolledLeft : "",
    scrolledRight ? classes.tmTableScrolledRight : "",
  ]
    .filter(Boolean)
    .join(" ");

  const noData = table?.getRowModel().rows.length === 0;

  return (
    <Box
      ref={scrollContainerRef}
      className={containerClassName}
      onScroll={handleScroll}
    >
      <Table
        stickyHeader
        {...rest}
        className={classes.tmTableGrid}
        style={{
          gridTemplateColumns,
          minWidth: table.getTotalSize(),
        }}
      />

      {loading === true && noData && (
        <Flex direction="column" gap="0" justify="center" align="center" my="xl">
          <Loader size="lg" />
        </Flex>
      )}
      {loading === false && noData && (
        <Flex direction="column" gap="0" justify="center" align="center" my="xl">
          <Text fz="3em" component="i" className="fal fa-magnifying-glass" />
          <Text fz="lg">{noResultsLabel}</Text>
        </Flex>
      )}
    </Box>
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
    <Table.Thead style={{ display: "contents" }}>
      {table.getHeaderGroups().map((headerGroup) => (
        <Table.Tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            const isPinned = header.column.getIsPinned();
            const isLastLeftPinnedColumn =
              isPinned === "left" && leftLeafCols.at(-1)?.id === header.column.id;
            const isFirstRightPinnedColumn =
              isPinned === "right" && rightLeafCols[0]?.id === header.column.id;

            const isSticky = isLastLeftPinnedColumn || isFirstRightPinnedColumn;
            let stickyClassName = isSticky
              ? classes.tmTableStickyColumn
              : undefined;
            if (isLastLeftPinnedColumn) {
              stickyClassName = `${stickyClassName} ${classes.tmTableStickyLeft}`;
            } else if (isFirstRightPinnedColumn) {
              stickyClassName = `${stickyClassName} ${classes.tmTableStickyRight}`;
            }

            const thClassName = [classes.tmTableTh, stickyClassName]
              .filter(Boolean)
              .join(" ");

            return (
              <Table.Th
                key={header.id}
                data-testid={
                  header.column.id ? "col-header-" + header.column.id : ""
                }
                className={thClassName}
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
                p="xs"
                style={{
                  left:
                    isPinned === "left"
                      ? `${header.column.getStart("left")}px`
                      : undefined,
                  right:
                    isPinned === "right"
                      ? `${header.column.getAfter("right")}px`
                      : undefined,
                  zIndex: isPinned ? 10 : 3,
                }}
              >
                {header.isPlaceholder ? null : (
                  <Flex justify="space-between" align="center" w="100%">
                    {(header.column.getCanSort() &&
                      header.column.getIsSorted() && (
                        <span>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </span>
                      )) ||
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    {header.column.getCanSort() &&
                      header.column.getIsSorted() && (
                        <i
                          className={`sort-icon fa-thin fa-chevron-${header.column.getIsSorted() === "asc" ? "up" : "down"}`}
                        />
                      )}
                  </Flex>
                )}
              </Table.Th>
            );
          })}
        </Table.Tr>
      ))}
    </Table.Thead>
  );
}

function TBodyTd<T extends RowData>({
  cell,
  ...tdProps
}: { cell: Cell<AnyFeatures, T> } & ComponentProps<typeof Table.Td>) {
  const pinningStyles = commonPinningStyles(
    cell.column,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cell.getContext().table as TanstackTableDef<AnyFeatures, T>,
  );
  return (
    <Table.Td
      {...tdProps}
      className={pinningStyles.className}
      style={{
        display: "flex",
        alignItems: "center",
        ...pinningStyles.style,
        overflow: "hidden",
      }}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </Table.Td>
  );
}

function TBodyTr<T extends RowData, TF extends AnyTableFeaturesRecord = AnyFeatures>({
  mih,
  row: rowArg,
  ...trProps
}: {
  mih?: TableTrProps["mih"];
  row: Row<TF, T>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = rowArg as Row<AnyFeatures, T>;
  return (
    <Table.Tr
      key={row.id}
      className={classes.tmTableBodyTr}
      {...trProps}
    >
      {row.getVisibleCells().map((cell) => {
        return <TBodyTd key={"cell-td-" + cell.id} cell={cell} mih={mih} />;
      })}
    </Table.Tr>
  );
}

function ExpandedTBodyTr<T extends RowData, TF extends AnyTableFeaturesRecord = AnyFeatures>({
  row: rowArg,
  children,
  expandedTopRowConfig,
  ...trProps
}: {
  /**
   * When expanded each "row" gets two Table.Tr.
   * This config is for the first row, then the dropdown content is rendered in the second row (children).
   */
  expandedTopRowConfig?: {
    /** Column.Id[] - Visible left cells */
    visibleLeftColumnIds: string[];
    /** Column.Id[] - Visible right cells */
    visibleRightColumnIds: string[];
    /** Content that should be rendered inside the leftover space in between, rendered inside a Td with full colspan of leftover space */
    centerCellContent: ReactNode;
  };
  rightVisibleCells?: string[];
  leftVisibleCells?: string[];
  row: Row<TF, T>;
} & TableTrProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = rowArg as Row<AnyFeatures, T>;
  const rowCellRecord = row.getAllCellsByColumnId();
  const leftCellCount = expandedTopRowConfig?.visibleLeftColumnIds.length || 0;
  const rightCellCount =
    expandedTopRowConfig?.visibleRightColumnIds.length || 0;
  const centerSpan =
    Object.keys(rowCellRecord).length - leftCellCount - rightCellCount;

  return (
    row.getIsExpanded() && (
      <>
        {expandedTopRowConfig && (
          <Table.Tr className={classes.tmTableExpandedTopTr}>
            {expandedTopRowConfig?.visibleLeftColumnIds.map((cellId) => {
              const cell = rowCellRecord[cellId];
              if (!cell) {
                console.warn(
                  cellId + " cell id does not exist in visible cells",
                );
              }
              return (
                <TBodyTd
                  key={"cell-td-exp-left-" + cell.id}
                  cell={cell}
                  mih="52px"
                />
              );
            })}
            <Table.Td
              key={"cell-td-exp-center" + row.id}
              style={{
                padding: "var(--table-vertical-spacing) 0",
                borderBottom: "1px solid var(--mantine-color-default-border)",
                gridColumn: `span ${centerSpan}`,
              }}
            >
              {expandedTopRowConfig.centerCellContent}
            </Table.Td>
            {expandedTopRowConfig?.visibleRightColumnIds.map((cellId) => {
              const cell = rowCellRecord[cellId];
              if (!cell) {
                console.warn(
                  cellId + " cell id does not exist in visible cells",
                );
              }
              return (
                <TBodyTd
                  key={"cell-td-exp-right-" + cell.id}
                  cell={cell}
                  mih="52px"
                />
              );
            })}
          </Table.Tr>
        )}
        <Table.Tr
          key={"sub-" + row.id}
          className={classes.tmTableSubTr}
          {...trProps}
        >
          <Table.Td
            style={{
              padding: 0,
              borderBottom: "1px solid var(--mantine-color-default-border)",
              gridColumn: "1 / -1",
            }}
          >
            {children}
          </Table.Td>
        </Table.Tr>
      </>
    )
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

function ExpandRowChevron<T extends RowData, TF extends AnyTableFeaturesRecord = AnyFeatures>({
  row: rowArg,
}: {
  row: Row<TF, T>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = rowArg as Row<AnyFeatures, T>;
  return (
    <Flex
      justify="center"
      align="center"
      w="100%"
      h="100%"
      onClick={row.getToggleExpandedHandler()}
      style={{ cursor: "pointer" }}
      mah="20px"
    >
      <ActionIcon mah="20px" size="xl" variant="transparent" w="100%" h="100%">
        {row.getIsExpanded() ? (
          <i className="fa-light fa-chevron-up" />
        ) : (
          <i className="fa-regular fa-chevron-down" />
        )}
      </ActionIcon>
    </Flex>
  );
}

function ClientSidePagination<T extends RowData, TF extends AnyTableFeaturesRecord = AnyFeatures>({
  table: tableArg,
}: {
  table: TanstackTableDef<TF, T>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = tableArg as TanstackTableDef<AnyFeatures, T>;
  return (
    <Flex gap="md">
      <Flex pt="2px">
        <Select
          scrollAreaProps={{ type: "never" }}
          onChange={(v) => {
            table.setPageSize(v || 25);
          }}
          size="xs"
          value={table.store.state.pagination.pageSize}
          w="80px"
          data={[25, 50, 100]}
        />
      </Flex>
      <Pagination
        size="md"
        value={table.store.state.pagination.pageIndex + 1}
        onChange={(pageIndex) => {
          table.setPagination((p) => ({
            ...p,
            pageIndex: pageIndex - 1,
          }));
        }}
        total={Math.ceil(
          (table?.getFilteredRowModel().flatRows?.length || 0) /
            table.store.state.pagination.pageSize,
        )}
      />
    </Flex>
  );
}

export const TMTable = {
  commonPinningStyles,
  RoundedCornerWrapper,
  THead,
  SelectAllCheckbox,
  SelectRowCheckbox,
  ExpandRowChevron,
  TBodyTr,
  Table: TableComponent,
  ExpandedTBodyTr: ExpandedTBodyTr,
  ClientSidePagination,
};
