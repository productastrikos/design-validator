// ─────────────────────────────────────────────────────────────────────────────
// Upload picker filter shared by every document screen. Mirrors what the server's
// extractor reads (server/lib/extract.js). The octet-stream entry keeps .dwg/.dxf
// selectable on systems that do not register a MIME type for CAD files.
// ─────────────────────────────────────────────────────────────────────────────

export const DOC_ACCEPT = [
  '.pdf', '.doc', '.docx', '.rtf', '.odt', '.txt', '.md',
  '.xlsx', '.xlsm', '.xls', '.ods', '.csv', '.tsv',
  '.pptx', '.odp',
  '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp', '.gif',
  '.dwg', '.dxf',
  'application/octet-stream',
].join(',');
