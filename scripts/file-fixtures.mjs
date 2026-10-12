import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Small, deterministic documents; no office software or host packages required.
function zip(entries) {
  const chunks = [];
  const directory = [];
  let offset = 0;
  for (const [path, text] of Object.entries(entries)) {
    const name = Buffer.from(path);
    const data = Buffer.from(text);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    chunks.push(header, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += header.length + name.length + data.length;
  }
  const directoryBytes = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(directoryBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directoryBytes, end]);
}

function pdf(lines) {
  const stream = `BT /F1 12 Tf 50 780 Td 18 TL ${lines.map((line, index) => `${index ? "T* " : ""}(${line}) Tj`).join(" ")} ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const start = Buffer.byteLength(content);
  content += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(content);
}

const relationships = target => `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${target}"/></Relationships>`;
const contentTypes = (path, type) => `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/${path}" ContentType="${type}"/></Types>`;

export const fixtures = [
  {
    filename: "invoice.csv", mediaType: "text/csv", code: "CSV-MAPLE", total: 37,
    bytes: Buffer.from('code,item,amount\r\nCSV-MAPLE,"Paper, recycled",12\r\nCSV-MAPLE,"Binder ""large""",25\r\n'),
  },
  {
    filename: "invoice.pdf", mediaType: "application/pdf", code: "PDF-CEDAR", total: 28,
    bytes: pdf(["Invoice code: PDF-CEDAR", "Item A amount: 17.00", "Item B amount: 11.00", "Calculate the sum of the two item amounts."]),
  },
  {
    filename: "invoice.docx", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", code: "DOCX-BIRCH", total: 19.75,
    bytes: zip({
      "[Content_Types].xml": contentTypes("word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"),
      "_rels/.rels": relationships("word/document.xml"),
      "word/document.xml": '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Invoice code: DOCX-BIRCH</w:t></w:r></w:p><w:p><w:r><w:t>Item A amount: 12.50</w:t></w:r></w:p><w:p><w:r><w:t>Item B amount: 7.25</w:t></w:r></w:p><w:sectPr/></w:body></w:document>',
    }),
  },
  {
    filename: "invoice.xlsx", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", code: "XLSX-ASPEN", total: 42.5,
    bytes: zip({
      "[Content_Types].xml": contentTypes("xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml").replace("</Types>", '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
      "_rels/.rels": relationships("xl/workbook.xml"),
      "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Invoice" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      "xl/worksheets/sheet1.xml": '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Code</t></is></c><c r="B1" t="inlineStr"><is><t>Amount</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>XLSX-ASPEN</t></is></c><c r="B2"><v>15.75</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>XLSX-ASPEN</t></is></c><c r="B3"><v>26.75</v></c></row><row r="4"><c r="A4" t="inlineStr"><is><t>Total</t></is></c><c r="B4"><f>SUM(B2:B3)</f><v>42.5</v></c></row></sheetData></worksheet>',
    }),
  },
];

export async function writeFixtures(directory = resolve(".runs/file-fixtures")) {
  await mkdir(directory, { recursive: true });
  for (const fixture of fixtures) await writeFile(resolve(directory, fixture.filename), fixture.bytes);
  return directory;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`Created CSV, PDF, DOCX and XLSX fixtures in ${await writeFixtures()}`);
}
