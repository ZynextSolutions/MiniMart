import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import ExcelJS from "exceljs";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "right";
}

export interface ExportTableData {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
  summary?: Record<string, string | number>;
}

const MARGIN = 40;
const ROW_FONT_SIZE = 8;
const HEADER_FONT_SIZE = 9;
const TITLE_FONT_SIZE = 16;
const LINE_HEIGHT = 12;
const CELL_PADDING = 4;
const MIN_COL_WIDTH = 48;

const NUMERIC_KEY_PATTERN =
  /amount|total|revenue|tax|discount|qty|quantity|count|margin|cogs|price|sales|balance|pct|percent|debit|credit|cost|value|subtotal/i;

function encodePdfText(text: string): string {
  return text
    .replace(/\u0E3F/g, "THB ")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, "?");
}

function isNumericColumn(col: ExportColumn, rows: ExportTableData["rows"]): boolean {
  if (col.align === "right") return true;
  if (col.align === "left") return false;
  if (NUMERIC_KEY_PATTERN.test(col.key)) return true;
  const sample = rows.slice(0, 20).map((row) => String(row[col.key] ?? ""));
  return (
    sample.length > 0 &&
    sample.every((value) => /^-?[\d,.\s%]+$|^(THB|Ks|USD|EUR)\s/.test(value.trim()))
  );
}

function computeColumnWidths(
  columns: ExportColumn[],
  rows: ExportTableData["rows"],
  tableWidth: number,
  font: PDFFont,
  fontBold: PDFFont,
): number[] {
  const weights = columns.map((col) => {
    if (col.width) return col.width;
    let maxWidth = fontBold.widthOfTextAtSize(encodePdfText(col.header), HEADER_FONT_SIZE);
    for (const row of rows.slice(0, 100)) {
      const text = encodePdfText(String(row[col.key] ?? ""));
      maxWidth = Math.max(maxWidth, font.widthOfTextAtSize(text, ROW_FONT_SIZE));
    }
    return maxWidth + CELL_PADDING * 2;
  });

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const scaled =
    total > tableWidth
      ? weights.map((weight) => (weight / total) * tableWidth)
      : weights.map((weight) => weight + (tableWidth - total) / columns.length);

  return scaled.map((width) => Math.max(MIN_COL_WIDTH, width));
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const safe = encodePdfText(text);
  if (!safe) return [""];

  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    let chunk = "";
    for (const char of word) {
      const next = chunk + char;
      if (font.widthOfTextAtSize(next, fontSize) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = next;
      }
    }
    current = chunk;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function drawFooter(targetPage: PDFPage, pageNumber: number, font: PDFFont) {
  const footer = `Page ${pageNumber} · Generated ${new Date().toLocaleString("en-GB")}`;
  targetPage.drawText(encodePdfText(footer), {
    x: MARGIN,
    y: 24,
    size: 8,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
}

function drawTableHeader(
  page: PDFPage,
  y: number,
  data: ExportTableData,
  colWidths: number[],
  colAlignments: ("left" | "right")[],
  tableWidth: number,
  fontBold: PDFFont,
) {
  const headerHeight = 22;

  page.drawRectangle({
    x: MARGIN,
    y: y - headerHeight,
    width: tableWidth,
    height: headerHeight,
    color: rgb(0.93, 0.93, 0.93),
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.5,
  });

  let x = MARGIN;
  data.columns.forEach((col, index) => {
    const headerLines = wrapText(
      col.header,
      colWidths[index] - CELL_PADDING * 2,
      fontBold,
      HEADER_FONT_SIZE,
    );
    const headerText = headerLines[0] ?? col.header;
    const textWidth = fontBold.widthOfTextAtSize(headerText, HEADER_FONT_SIZE);
    const textX =
      colAlignments[index] === "right"
        ? x + colWidths[index] - CELL_PADDING - textWidth
        : x + CELL_PADDING;

    page.drawText(headerText, {
      x: textX,
      y: y - 15,
      size: HEADER_FONT_SIZE,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.15),
    });
    x += colWidths[index];
  });

  return y - headerHeight;
}

function measureRowHeight(
  row: Record<string, string | number>,
  columns: ExportColumn[],
  colWidths: number[],
  font: PDFFont,
): number {
  let rowHeight = 18;
  columns.forEach((col, index) => {
    const lines = wrapText(
      String(row[col.key] ?? ""),
      colWidths[index] - CELL_PADDING * 2,
      font,
      ROW_FONT_SIZE,
    );
    rowHeight = Math.max(rowHeight, lines.length * LINE_HEIGHT + 6);
  });
  return rowHeight;
}

function drawDataRow(
  page: PDFPage,
  y: number,
  row: Record<string, string | number>,
  data: ExportTableData,
  colWidths: number[],
  colAlignments: ("left" | "right")[],
  tableWidth: number,
  rowHeight: number,
  font: PDFFont,
) {
  page.drawRectangle({
    x: MARGIN,
    y: y - rowHeight,
    width: tableWidth,
    height: rowHeight,
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 0.5,
  });

  let x = MARGIN;
  data.columns.forEach((col, index) => {
    const lines = wrapText(
      String(row[col.key] ?? ""),
      colWidths[index] - CELL_PADDING * 2,
      font,
      ROW_FONT_SIZE,
    );
    let lineY = y - 12;

    for (const line of lines) {
      const textWidth = font.widthOfTextAtSize(line, ROW_FONT_SIZE);
      const textX =
        colAlignments[index] === "right"
          ? x + colWidths[index] - CELL_PADDING - textWidth
          : x + CELL_PADDING;

      page.drawText(line, {
        x: textX,
        y: lineY,
        size: ROW_FONT_SIZE,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      lineY -= LINE_HEIGHT;
    }

    x += colWidths[index];
  });
}

export class ReportExportService {
  static async exportToPdf(data: ExportTableData): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const useLandscape = data.columns.length >= 5;
    const pageWidth = useLandscape ? 842 : 595;
    const pageHeight = useLandscape ? 595 : 842;
    const tableWidth = pageWidth - MARGIN * 2;

    const colWidths = computeColumnWidths(data.columns, data.rows, tableWidth, font, fontBold);
    const colAlignments = data.columns.map((col) =>
      isNumericColumn(col, data.rows) ? "right" : "left",
    );

    let pageNumber = 1;
    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - MARGIN;

    const addPageWithHeader = () => {
      drawFooter(page, pageNumber, font);
      pageNumber += 1;
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - MARGIN;
      y = drawTableHeader(page, y, data, colWidths, colAlignments, tableWidth, fontBold) - 4;
    };

    page.drawText(encodePdfText(data.title), {
      x: MARGIN,
      y,
      size: TITLE_FONT_SIZE,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    y -= 24;

    if (data.subtitle) {
      page.drawText(encodePdfText(data.subtitle), {
        x: MARGIN,
        y,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 18;
    }

    y = drawTableHeader(page, y, data, colWidths, colAlignments, tableWidth, fontBold) - 4;

    for (const row of data.rows) {
      const rowHeight = measureRowHeight(row, data.columns, colWidths, font);
      if (y - rowHeight < MARGIN + 30) addPageWithHeader();

      drawDataRow(page, y, row, data, colWidths, colAlignments, tableWidth, rowHeight, font);
      y -= rowHeight;
    }

    if (data.summary) {
      y -= 12;
      if (y < MARGIN + 60) addPageWithHeader();

      page.drawText("Summary", {
        x: MARGIN,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= 16;

      for (const [key, value] of Object.entries(data.summary)) {
        if (y < MARGIN + 30) addPageWithHeader();
        page.drawText(encodePdfText(`${key}: ${value}`), {
          x: MARGIN,
          y,
          size: 9,
          font: fontBold,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= 16;
      }
    }

    drawFooter(page, pageNumber, font);

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  static async exportToExcel(data: ExportTableData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Mini Mart ERP";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(data.title.slice(0, 31));

    sheet.mergeCells(1, 1, 1, data.columns.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = data.title;
    titleCell.font = { bold: true, size: 14 };

    if (data.subtitle) {
      sheet.mergeCells(2, 1, 2, data.columns.length);
      sheet.getCell(2, 1).value = data.subtitle;
      sheet.getCell(2, 1).font = { size: 10, color: { argb: "666666" } };
    }

    const headerRow = data.subtitle ? 4 : 3;
    sheet.columns = data.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? 18,
    }));

    const header = sheet.getRow(headerRow);
    data.columns.forEach((col, i) => {
      header.getCell(i + 1).value = col.header;
      header.getCell(i + 1).font = { bold: true };
      header.getCell(i + 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    });

    data.rows.forEach((row, idx) => {
      const r = sheet.getRow(headerRow + 1 + idx);
      data.columns.forEach((col, i) => {
        r.getCell(i + 1).value = row[col.key] ?? "";
      });
    });

    if (data.summary) {
      const summaryRow = headerRow + 1 + data.rows.length + 2;
      let col = 1;
      for (const [key, value] of Object.entries(data.summary)) {
        sheet.getCell(summaryRow, col).value = `${key}: ${value}`;
        sheet.getCell(summaryRow, col).font = { bold: true };
        col++;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
