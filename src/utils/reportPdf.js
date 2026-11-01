import { REPORT_EXPORT_HEADERS, reportExportRows } from './csv.js'

/** Load PDF dependencies only when an export is requested. Returns an actual PDF Blob. */
export async function reportPdf(rows, rangeLabel, mayBeTruncated = false) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({ title: 'RoadReport report list', subject: rangeLabel })
  const margin = 12
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  const generated = `Generated: ${new Date().toLocaleString()}`
  pdf.setFontSize(9)
  const rangeLines = pdf.splitTextToSize(rangeLabel, width - margin * 2)
  const dateY = 23 + rangeLines.length * 4
  const tableY = dateY + (mayBeTruncated ? 12 : 7)

  autoTable(pdf, {
    head: [REPORT_EXPORT_HEADERS],
    body: reportExportRows(rows).map((row) => row.map((value) => String(value ?? ''))),
    startY: tableY,
    margin: { top: tableY, right: margin, bottom: 15, left: margin },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [130, 63, 28] },
    columnStyles: { 3: { cellWidth: 58 } },
    willDrawPage: () => {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.setTextColor(30)
      pdf.text('RoadReport report list', margin, 16)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(rangeLines, margin, 23)
      pdf.text(generated, margin, dateY)
      if (mayBeTruncated) {
        pdf.setFontSize(8)
        pdf.text('Results may be incomplete: the 2,000-report limit was reached. Narrow the date range.', margin, dateY + 5)
      }
    },
  })

  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(90)
    pdf.text(`${rows.length.toLocaleString()} reports`, margin, height - 7)
    pdf.text(`Page ${page} of ${pages}`, width - margin, height - 7, { align: 'right' })
  }
  return pdf.output('blob')
}
