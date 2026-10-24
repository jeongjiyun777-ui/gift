export interface UreaExcelRecord {
  purchased_on: string;
  merchant_name: string;
  business_number: string | null;
  card_company: string | null;
  unit_price: string;
  liters: string;
  supply_amount: string;
  vat_amount: string;
  total_amount: string;
}

export async function createUreaWorkbook(records: UreaExcelRecord[], label: "요소수" | "경유" = "요소수") {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(label);
  sheet.addRow(["날짜", "상호명/대표자", "사업자번호", "카드사", "단가 (원)", "수량 (L)", "공급가액 (원)", "세액 (원)", "총액 (원)"]);
  for (const record of records) {
    sheet.addRow([
      new Date(`${record.purchased_on}T00:00:00Z`), record.merchant_name,
      record.business_number?.trim() || "-", record.card_company?.trim() || "-",
      Number(record.unit_price), Number(record.liters), Number(record.supply_amount),
      Number(record.vat_amount), Number(record.total_amount),
    ]);
  }
  const widths = [15, 28, 20, 18, 18, 15, 20, 18, 20];
  sheet.columns.forEach((column, index) => { column.width = widths[index]; });
  sheet.eachRow((row) => row.eachCell((cell) => {
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }));
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF107C41" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
  sheet.getRow(1).height = 25;
  sheet.getColumn(1).numFmt = "yyyy-mm-dd";
  for (const column of [5, 7, 8, 9]) sheet.getColumn(column).numFmt = "#,##0.##";
  sheet.getColumn(6).numFmt = "#,##0.###";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = "A1:I1";
  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer;
}
