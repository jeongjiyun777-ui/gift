export interface DrivingExcelRecord {
  id: number | string;
  operated_on: string;
  category: string | null;
  shipper_name: string;
  region_1: string | null;
  region_2: string | null;
  shipping_line: string | null;
  container_spec: string | null;
  container_no: string | null;
  charge_amount: number | string;
  tax_amount: number | string | null;
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
  sheet.addRow(["번호", "일자", "구분", "화주", "지역", "지역", "라인", "규격", "CNTR", "청구가액", "세액", "비고"]);
  for (const record of records) {
    sheet.addRow([
      String(record.id), record.operated_on, record.category, record.shipper_name,
      record.region_1, record.region_2, record.shipping_line, record.container_spec,
      record.container_no, excelAmount(record.charge_amount), excelAmount(record.tax_amount), record.memo,
    ]);
  }
  const widths = [10, 15, 12, 20, 20, 20, 14, 10, 20, 18, 18, 30];
  sheet.columns.forEach((column, index) => { column.width = widths[index]; });
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF107C41" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  sheet.getRow(1).height = 25;
  sheet.getColumn(10).numFmt = "#,##0";
  sheet.getColumn(11).numFmt = "#,##0";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = "A1:L1";
  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer;
}
