import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import {
  DiagramBuilder,
  formatDiagramNumber,
  safeDiagramId,
} from "#api/modules/ai/utils/diagram-compilers/diagram-builder";

type DataIntent = Extract<LessonSummaryDiagramIntent, { family: "DATA_STATISTICS" }>;
type ChartArchetype = "BAR_CHART" | "LINE_CHART" | "HISTOGRAM" | "PIE_CHART";
type ChartIntent = DataIntent & { archetype: ChartArchetype };

export function compileDataDiagram(intent: DataIntent): LessonSummaryDiagramSpec {
  switch (intent.archetype) {
    case "VALUE_TABLE":
      return compileValueTable(intent);
    case "BAR_CHART":
    case "LINE_CHART":
    case "HISTOGRAM":
    case "PIE_CHART":
      return compileChart(intent);
    case "CLOCK":
      return compileClock(intent);
    case "PICTOGRAM":
      return compilePictogram(intent);
  }
}

function compilePictogram(intent: Extract<DataIntent, { archetype: "PICTOGRAM" }>) {
  const commonValueCount = Math.min(intent.categories.length, intent.values.length);
  const categories = intent.categories.slice(0, commonValueCount);
  const values = intent.values.slice(0, commonValueCount);
  const symbolCounts = values.map((value) => value / intent.valuePerSymbol);
  const maximumSymbols = Math.max(...symbolCounts, 1);
  const rowGap = 1.05;
  const symbolGap = 0.62;
  const iconStartX = 2.15;
  const maxX = iconStartX + Math.max(0, maximumSymbols - 1) * symbolGap + 1;
  const builder = new DiagramBuilder(
    {
      minX: -1.4,
      minY: -1.2,
      width: maxX + 2,
      height: Math.max(2.6, categories.length * rowGap + 1.7),
    },
    intent.caption,
  );
  for (const [categoryIndex, category] of categories.entries()) {
    const y = (categories.length - categoryIndex - 1) * rowGap + 0.35;
    const categoryAnchor = builder.addPoint(
      hiddenPoint(`pictogramCategory${categoryIndex}`, 1.55, y),
    );
    builder.addLabel({
      text: category,
      anchorPointId: categoryAnchor,
      anchorPrimitiveId: null,
      position: "LEFT",
    });
    for (
      let symbolIndex = 0;
      symbolIndex < symbolCounts[categoryIndex]!;
      symbolIndex += 1
    ) {
      addPictogramSymbol(
        builder,
        `pictogram${categoryIndex}Symbol${symbolIndex}`,
        iconStartX + symbolIndex * symbolGap,
        y,
        intent.symbol,
      );
    }
  }
  const legendAnchor = builder.addPoint(hiddenPoint("pictogramLegend", 1.55, -0.62));
  builder.addLabel({
    text: `${pictogramSymbolGlyph(intent.symbol)} = ${intent.valuePerSymbol} ${intent.unit}`,
    anchorPointId: legendAnchor,
    anchorPrimitiveId: null,
    position: "RIGHT",
  });
  return builder.build();
}

function addPictogramSymbol(
  builder: DiagramBuilder,
  id: string,
  x: number,
  y: number,
  symbol: "CIRCLE" | "SQUARE" | "STAR",
) {
  const centerId = builder.addPoint(hiddenPoint(`${id}Center`, x, y));
  if (symbol === "CIRCLE") {
    builder.addCircle(id, centerId, 0.21);
    return;
  }
  const pointCount = symbol === "STAR" ? 10 : 4;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const radius = symbol === "STAR" && index % 2 === 1 ? 0.1 : 0.23;
    const angle =
      symbol === "STAR"
        ? Math.PI / 2 + (index * Math.PI) / 5
        : Math.PI / 4 + (index * Math.PI) / 2;
    return builder.addPoint(
      hiddenPoint(
        `${id}Point${index}`,
        x + radius * Math.cos(angle),
        y + radius * Math.sin(angle),
      ),
    );
  });
  builder.addPolygon(id, points, "SOFT_BLUE");
}

function pictogramSymbolGlyph(symbol: "CIRCLE" | "SQUARE" | "STAR") {
  if (symbol === "STAR") return "★";
  if (symbol === "SQUARE") return "■";
  return "●";
}

function compileValueTable(intent: Extract<DataIntent, { archetype: "VALUE_TABLE" }>) {
  const hasTrailingRowsPlaceholder =
    intent.columns.at(-1)?.trim().toLowerCase() === "rows" &&
    intent.rows.every((row) => row.length === intent.columns.length - 1);
  const columns = hasTrailingRowsPlaceholder
    ? intent.columns.slice(0, -1)
    : intent.columns;
  const columnCount = columns.length;
  const rowCount = intent.rows.length + 1;
  const rows = [columns, ...intent.rows];
  const columnWidths = columns.map((_, columnIndex) => {
    const maximumCharacterCount = Math.max(
      ...rows.map((row) => Array.from(row[columnIndex] ?? "").length),
      1,
    );
    return Math.min(Math.max(maximumCharacterCount * 0.48 + 1.8, 3), 13);
  });
  const columnBoundaries = columnWidths.reduce<number[]>(
    (boundaries, width) => [...boundaries, boundaries.at(-1)! + width],
    [0],
  );
  const tableWidth = columnBoundaries.at(-1)!;
  const rowHeight = 1.45;
  const tableHeight = rowCount * rowHeight;
  const builder = new DiagramBuilder(
    {
      minX: -0.8,
      minY: -0.8,
      width: tableWidth + 1.6,
      height: tableHeight + 1.6,
    },
    intent.caption,
  );
  for (let column = 0; column <= columnCount; column += 1) {
    const x = columnBoundaries[column]!;
    const bottom = builder.addPoint(hiddenPoint(`tableColumn${column}Bottom`, x, 0));
    const top = builder.addPoint(hiddenPoint(`tableColumn${column}Top`, x, tableHeight));
    builder.addSegment(safeDiagramId("tableColumn", column), bottom, top);
  }
  for (let row = 0; row <= rowCount; row += 1) {
    const y = row * rowHeight;
    const left = builder.addPoint(hiddenPoint(`tableRow${row}Left`, 0, y));
    const right = builder.addPoint(hiddenPoint(`tableRow${row}Right`, tableWidth, y));
    builder.addSegment(safeDiagramId("tableRow", row), left, right);
  }
  for (const [rowIndex, row] of rows.entries()) {
    for (const [columnIndex, value] of row.slice(0, columnCount).entries()) {
      const anchor = builder.addPoint(
        hiddenPoint(
          `tableCellR${rowIndex}C${columnIndex}`,
          (columnBoundaries[columnIndex]! + columnBoundaries[columnIndex + 1]!) / 2,
          tableHeight - (rowIndex + 0.5) * rowHeight,
        ),
      );
      builder.addLabel({
        text: value,
        anchorPointId: anchor,
        anchorPrimitiveId: null,
        position: "CENTER",
      });
    }
  }
  return builder.build();
}

function compileChart(intent: ChartIntent) {
  const commonValueCount = Math.min(
    intent.categories.length,
    ...intent.series.map((series) => series.values.length),
  );
  if (commonValueCount < 1) {
    throw new Error("A chart requires at least one category with a value.");
  }
  const drawableIntent: ChartIntent = {
    ...intent,
    categories: intent.categories.slice(0, commonValueCount),
    series: intent.series.map((series) => ({
      ...series,
      values: series.values.slice(0, commonValueCount),
    })),
  };
  return drawableIntent.archetype === "PIE_CHART"
    ? compilePieChart(drawableIntent)
    : compileCartesianChart(drawableIntent);
}

function compileCartesianChart(intent: ChartIntent) {
  const values = intent.series.flatMap((series) => series.values);
  if (values.some((value) => value < 0)) {
    throw new Error(`${intent.archetype} currently requires non-negative values.`);
  }
  const maximum = Math.max(...values, 0);
  const yStep = chooseNiceChartStep(maximum);
  const yMax = Math.max(yStep, Math.ceil(maximum / yStep) * yStep);
  const displayYMax = 6;
  const displayY = (value: number) => (value / yMax) * displayYMax;
  const width = Math.max(intent.categories.length, 2);
  const hasSeriesLegend = intent.series.length > 1;
  const hasStackedLegend =
    hasSeriesLegend &&
    intent.series.reduce((length, series) => length + series.label.length, 0) > 16;
  const bottomMargin = hasStackedLegend ? 2.55 : hasSeriesLegend ? 2.2 : 1.2;
  const horizontalMargin = 1.15;
  const builder = new DiagramBuilder(
    {
      minX: -horizontalMargin,
      minY: -bottomMargin,
      width: width + horizontalMargin * 2,
      height: displayYMax + bottomMargin + 1.2,
    },
    intent.caption,
  );
  const origin = builder.addPoint(hiddenPoint("chartOrigin", 0, 0));
  const xEnd = builder.addPoint(hiddenPoint("chartXEnd", width, 0));
  const yEnd = builder.addPoint(hiddenPoint("chartYEnd", 0, displayYMax));
  builder.addSegment("chartXAxis", origin, xEnd);
  builder.addSegment("chartYAxis", origin, yEnd);
  const tickHalf = Math.max(Math.min(width, displayYMax) * 0.018, 0.08);
  const staggerCategoryLabels =
    intent.categories.length >= 3 &&
    intent.categories.some((category) => category.length >= 7);
  let tickIndex = 0;
  for (let value = 0; value <= yMax + yStep * 1e-8; value += yStep) {
    const y = displayY(value);
    const left = builder.addPoint(
      hiddenPoint(safeDiagramId("chartTickLeft", tickIndex), -tickHalf, y),
    );
    const right = builder.addPoint(
      hiddenPoint(safeDiagramId("chartTickRight", tickIndex), tickHalf, y),
    );
    builder.addSegment(safeDiagramId("chartYTick", tickIndex), left, right);
    builder.addLabel({
      text: formatDiagramNumber(value),
      anchorPointId: left,
      anchorPrimitiveId: null,
      position: "LEFT",
    });
    tickIndex += 1;
  }
  for (const [categoryIndex, category] of intent.categories.entries()) {
    const x = categoryIndex + 0.5;
    const bottom = builder.addPoint(
      hiddenPoint(`category${categoryIndex}Bottom`, x, -tickHalf),
    );
    const top = builder.addPoint(hiddenPoint(`category${categoryIndex}Top`, x, tickHalf));
    builder.addSegment(safeDiagramId("chartXTick", categoryIndex), bottom, top);
    const labelAnchor = builder.addPoint(
      hiddenPoint(
        `category${categoryIndex}Label`,
        x,
        -tickHalf - (staggerCategoryLabels && categoryIndex % 2 === 1 ? 0.38 : 0),
      ),
    );
    builder.addLabel({
      text: category,
      anchorPointId: labelAnchor,
      anchorPrimitiveId: null,
      position: "BOTTOM",
    });
  }
  const yAxisLabel =
    intent.unit || (intent.series.length === 1 ? intent.series[0]!.label : null);
  if (yAxisLabel) {
    builder.addLabel({
      text: yAxisLabel,
      anchorPointId: yEnd,
      anchorPrimitiveId: null,
      position: "TOP_RIGHT",
    });
  }

  if (intent.archetype === "LINE_CHART") {
    addLineChartSeries(builder, intent, displayY);
  } else {
    addBarChartSeries(builder, intent, displayY);
  }
  if (hasSeriesLegend) addSeriesLegend(builder, intent, width);
  return builder.build();
}

function chooseNiceChartStep(maximum: number) {
  if (maximum <= 0) return 1;
  const roughStep = maximum / 6;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

function addSeriesLegend(
  builder: DiagramBuilder,
  intent: ChartIntent,
  plotWidth: number,
) {
  const fills = ["SOFT_BLUE", "SOFT_GREEN", "SOFT_AMBER"] as const;
  const stacked =
    intent.series.reduce((length, series) => length + series.label.length, 0) > 16;
  for (const [seriesIndex, series] of intent.series.entries()) {
    const centerX = stacked
      ? plotWidth * 0.34
      : ((seriesIndex + 0.5) * plotWidth) / intent.series.length;
    const y = stacked ? -1.16 - seriesIndex * 0.5 : -1.48;
    const left = centerX - 0.34;
    if (intent.archetype === "LINE_CHART") {
      const from = builder.addPoint(hiddenPoint(`legend${seriesIndex}From`, left, y));
      const to = builder.addPoint(hiddenPoint(`legend${seriesIndex}To`, left + 0.28, y));
      builder.addSegment(`legend${seriesIndex}Line`, from, to);
    } else {
      const swatch = [
        builder.addPoint(hiddenPoint(`legend${seriesIndex}A`, left, y - 0.1)),
        builder.addPoint(hiddenPoint(`legend${seriesIndex}B`, left + 0.2, y - 0.1)),
        builder.addPoint(hiddenPoint(`legend${seriesIndex}C`, left + 0.2, y + 0.1)),
        builder.addPoint(hiddenPoint(`legend${seriesIndex}D`, left, y + 0.1)),
      ];
      builder.addPolygon(
        `legend${seriesIndex}Swatch`,
        swatch,
        fills[seriesIndex % fills.length],
      );
    }
    const anchor = builder.addPoint(
      hiddenPoint(`legend${seriesIndex}Label`, left + 0.32, y),
    );
    builder.addLabel({
      text: series.label,
      anchorPointId: anchor,
      anchorPrimitiveId: null,
      position: "RIGHT",
    });
  }
}

function addLineChartSeries(
  builder: DiagramBuilder,
  intent: ChartIntent,
  displayY: (value: number) => number,
) {
  for (const [seriesIndex, series] of intent.series.entries()) {
    const pointIds = series.values.map((value, valueIndex) => {
      const pointId = `series${seriesIndex}Point${valueIndex}`;
      builder.addPoint({
        id: pointId,
        x: valueIndex + 0.5,
        y: displayY(value),
        label: null,
        pointStyle: "FILLED",
        labelPosition: "TOP",
      });
      builder.addLabel({
        text: formatDiagramNumber(value),
        anchorPointId: pointId,
        anchorPrimitiveId: null,
        position: "TOP",
      });
      return pointId;
    });
    if (pointIds.length >= 2) {
      builder.addPolyline(safeDiagramId("chartSeries", seriesIndex), pointIds);
    }
  }
}

function addBarChartSeries(
  builder: DiagramBuilder,
  intent: ChartIntent,
  displayY: (value: number) => number,
) {
  const fills = ["SOFT_BLUE", "SOFT_GREEN", "SOFT_AMBER"] as const;
  const gap = intent.archetype === "HISTOGRAM" ? 0 : 0.12;
  const groupWidth = 1 - gap * 2;
  const barWidth = groupWidth / intent.series.length;
  for (const [seriesIndex, series] of intent.series.entries()) {
    for (const [valueIndex, value] of series.values.entries()) {
      const displayedValue = displayY(value);
      const displayedGroupValues = intent.series.map((candidate) =>
        displayY(candidate.values[valueIndex]!),
      );
      const verticalSpread =
        Math.max(...displayedGroupValues) - Math.min(...displayedGroupValues);
      const labelPosition = barValueLabelPosition(
        intent,
        seriesIndex,
        valueIndex,
        displayY,
      );
      const labelY =
        labelPosition === "CENTER"
          ? displayedValue / 2
          : verticalSpread <= 0.8
            ? displayedValue + (seriesIndex === 0 ? 0.85 : 0.28)
            : displayedValue + 0.28;
      const xStart = valueIndex + gap + seriesIndex * barWidth;
      const xEnd = xStart + barWidth;
      const points = [
        builder.addPoint(hiddenPoint(`bar${seriesIndex}Value${valueIndex}A`, xStart, 0)),
        builder.addPoint(hiddenPoint(`bar${seriesIndex}Value${valueIndex}B`, xEnd, 0)),
        builder.addPoint(
          hiddenPoint(`bar${seriesIndex}Value${valueIndex}C`, xEnd, displayedValue),
        ),
        builder.addPoint(
          hiddenPoint(`bar${seriesIndex}Value${valueIndex}D`, xStart, displayedValue),
        ),
      ];
      builder.addPolygon(
        `bar${seriesIndex}Value${valueIndex}`,
        points,
        fills[seriesIndex % fills.length],
      );
      const labelAnchor = builder.addPoint(
        hiddenPoint(
          `bar${seriesIndex}Value${valueIndex}Label`,
          (xStart + xEnd) / 2,
          labelY,
        ),
      );
      builder.addLabel({
        text: formatDiagramNumber(value),
        anchorPointId: labelAnchor,
        anchorPrimitiveId: null,
        position: labelPosition,
      });
    }
  }
}

function barValueLabelPosition(
  intent: ChartIntent,
  seriesIndex: number,
  valueIndex: number,
  displayY: (value: number) => number,
) {
  if (intent.series.length < 2) return "TOP" as const;
  const displayedValues = intent.series.map((series) => displayY(series.values[valueIndex]!));
  const verticalSpread = Math.max(...displayedValues) - Math.min(...displayedValues);
  if (verticalSpread > 0.8) {
    const displayedValue = displayedValues[seriesIndex]!;
    const isShorterThanPeer = displayedValue < Math.max(...displayedValues) - 1e-8;
    if (!isShorterThanPeer) return "TOP" as const;
    return "CENTER" as const;
  }
  return "TOP" as const;
}

function compilePieChart(intent: ChartIntent) {
  if (intent.series.length !== 1) {
    throw new Error("A pie chart requires exactly one data series.");
  }
  const values = intent.series[0]!.values;
  if (values.some((value) => value < 0)) {
    throw new Error("Pie chart values cannot be negative.");
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error("A pie chart requires a positive total.");
  const builder = new DiagramBuilder(
    { minX: -2.2, minY: -2.2, width: 4.4, height: 4.8 },
    intent.caption,
  );
  const center = builder.addPoint(hiddenPoint("pieCenter", 0, 0));
  builder.addCircle("pieCircle", center, 1.5);
  let angle = 90;
  for (const [index, value] of values.entries()) {
    const sweep = (value / total) * 360;
    const edgeAngle = (angle * Math.PI) / 180;
    const edge = builder.addPoint(
      hiddenPoint(
        safeDiagramId("pieEdge", index),
        1.5 * Math.cos(edgeAngle),
        1.5 * Math.sin(edgeAngle),
      ),
    );
    builder.addSegment(safeDiagramId("pieRadius", index), center, edge);
    const middleAngle = ((angle + sweep / 2) * Math.PI) / 180;
    const categoryText = intent.categories[index]!;
    const percentageText = `${formatDiagramNumber((value / total) * 100)}%`;
    const isLongLabel = categoryText.length >= 7;
    const labelRadius = sweep < 70 ? 0.95 : 0.72;
    const labelAngle =
      isLongLabel && Math.abs(Math.sin(middleAngle)) < 0.5
        ? middleAngle - Math.sign(Math.cos(middleAngle)) * 0.15
        : middleAngle;
    const labelX = labelRadius * Math.cos(labelAngle);
    const labelY = labelRadius * Math.sin(labelAngle);
    const categoryAnchor = builder.addPoint(
      hiddenPoint(safeDiagramId("pieCategoryLabel", index), labelX, labelY + 0.15),
    );
    builder.addLabel({
      text: categoryText,
      anchorPointId: categoryAnchor,
      anchorPrimitiveId: null,
      position: "CENTER",
    });
    const percentageAnchor = builder.addPoint(
      hiddenPoint(safeDiagramId("piePercentageLabel", index), labelX, labelY - 0.15),
    );
    builder.addLabel({
      text: percentageText,
      anchorPointId: percentageAnchor,
      anchorPrimitiveId: null,
      position: "CENTER",
    });
    angle += sweep;
  }
  return builder.build();
}

function compileClock(intent: Extract<DataIntent, { archetype: "CLOCK" }>) {
  const builder = new DiagramBuilder(
    { minX: -2, minY: -2, width: 4, height: 4.4 },
    intent.caption,
  );
  const center = builder.addPoint({
    id: "clockCenter",
    x: 0,
    y: 0,
    label: null,
    pointStyle: "FILLED",
    labelPosition: "TOP",
  });
  builder.addCircle("clockFace", center, 1.5);
  for (let hour = 1; hour <= 12; hour += 1) {
    const angle = ((90 - hour * 30) * Math.PI) / 180;
    const outer = builder.addPoint(
      hiddenPoint(`clockTick${hour}Outer`, 1.5 * Math.cos(angle), 1.5 * Math.sin(angle)),
    );
    const inner = builder.addPoint(
      hiddenPoint(
        `clockTick${hour}Inner`,
        1.34 * Math.cos(angle),
        1.34 * Math.sin(angle),
      ),
    );
    builder.addSegment(`clockTick${hour}`, inner, outer);
    if (![3, 6, 9, 12].includes(hour)) continue;
    const labelAnchor = builder.addPoint(
      hiddenPoint(`clockNumber${hour}`, 1.08 * Math.cos(angle), 1.08 * Math.sin(angle)),
    );
    builder.addLabel({
      text: String(hour),
      anchorPointId: labelAnchor,
      anchorPrimitiveId: null,
      position: "CENTER",
    });
  }
  const minuteAngle = ((90 - intent.minute * 6) * Math.PI) / 180;
  const hourAngle =
    ((90 - ((intent.hour % 12) + intent.minute / 60) * 30) * Math.PI) / 180;
  const minuteEnd = builder.addPoint(
    hiddenPoint(
      "minuteHandEnd",
      1.15 * Math.cos(minuteAngle),
      1.15 * Math.sin(minuteAngle),
    ),
  );
  const hourEnd = builder.addPoint(
    hiddenPoint("hourHandEnd", 0.82 * Math.cos(hourAngle), 0.82 * Math.sin(hourAngle)),
  );
  builder.addSegment("minuteHand", center, minuteEnd);
  builder.addSegment("hourHand", center, hourEnd);
  return builder.build();
}

function hiddenPoint(id: string, x: number, y: number) {
  return {
    id,
    x,
    y,
    label: null,
    pointStyle: "NONE" as const,
    labelPosition: "TOP" as const,
  };
}
