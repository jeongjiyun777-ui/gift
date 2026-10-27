export interface DrivingExcelRecord {
  id: number | string;
  operated_on: string;
  category: string | null;
  carrier_name: string;
  shipper_name: string | null;
  region_1: string | null;
  region_2: string | null;
  start_km?: number | null;
  km?: number | null;
  shipping_line: string | null;
  container_spec: string | null;
  container_no: string | null;
  charge_amount: number | string;
  tax_amount: number | string | null;
  calculated_tax_amount: string;
  total_amount: string;
  memo: string | null;
}

function excelAmount(value: number | string | null) {
  if (value === null || value === "") return null;
  const raw = typeof value === "string" ? value.replaceAll(",", "") : value;
  const number = Number(raw);
  return Number.isSafeInteger(number) ? number : String(value);
}

export async function createDrivingWorkbook(records: DrivingExcelRecord[]) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("운행기록");
  sheet.addRow(["번호", "일자", "구분", "운송사", "화주", "지역", "지역", "시작 → 출발지 (km)", "출발지 → 도착지 (km)", "라인", "규격", "CNTR", "공급가액", "세액", "합계금액", "비고"]);
  for (const record of records) {
    sheet.addRow([
      String(record.id), record.operated_on, record.category, record.carrier_name || "-", record.shipper_name || "-",
      record.region_1, record.region_2, record.start_km ?? null, record.km ?? null, record.shipping_line, record.container_spec,
      record.container_no, excelAmount(record.charge_amount), excelAmount(record.calculated_tax_amount), excelAmount(record.total_amount), record.memo,
    ]);
  }
  const widths = [10, 15, 12, 20, 20, 20, 20, 22, 22, 14, 10, 20, 18, 18, 20, 30];
  sheet.columns.forEach((column, index) => { column.width = widths[index]; });
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF107C41" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  sheet.getRow(1).height = 25;
  sheet.getColumn(13).numFmt = "#,##0";
  sheet.getColumn(14).numFmt = "#,##0";
  sheet.getColumn(15).numFmt = "#,##0";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = "A1:P1";
  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer;
}
