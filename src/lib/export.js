import JSZip from 'jszip';

/**
 * Converts inline HTML formatting tags to Markdown syntax.
 * Handles: <b>/<strong>, <i>/<em>, <u>, <s>/<strike>/<del>, <code>, <a href>
 * Also strips any remaining HTML tags and decodes entities.
 */
export function htmlToMarkdown(html) {
  if (!html) return '';

  let result = html;

  // Convert <a href="url">text</a> to [text](url)
  result = result.replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Convert <code>text</code> to `text`
  result = result.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');

  // Convert <b> and <strong> to **text**
  result = result.replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, '**$2**');

  // Convert <i> and <em> to *text*
  result = result.replace(/<(i|em)>([\s\S]*?)<\/\1>/gi, '*$2*');

  // Convert <s>, <strike>, <del> to ~~text~~
  result = result.replace(/<(s|strike|del)>([\s\S]*?)<\/\1>/gi, '~~$2~~');

  // Keep <u> as-is since Markdown has no underline
  result = result.replace(/<u>([\s\S]*?)<\/u>/gi, '$1');

  // Convert <br> / <br/> to newline
  result = result.replace(/<br\s*\/?>/gi, '\n');

  // Strip any remaining HTML tags
  result = result.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  result = result.replace(/&amp;/g, '&');
  result = result.replace(/&lt;/g, '<');
  result = result.replace(/&gt;/g, '>');
  result = result.replace(/&quot;/g, '"');
  result = result.replace(/&#39;/g, "'");
  result = result.replace(/&nbsp;/g, ' ');

  return result;
}

/**
 * Converts an array of blocks to a Markdown string.
 * Supports all 14 block types.
 */
export function blocksToMarkdown(blocks, pageTitle, database) {
  let md = '';

  if (pageTitle) {
    md += `# ${pageTitle}\n\n`;
  }

  let numberIndex = 1;
  let prevType = null;

  for (const block of blocks) {
    // Reset number index if previous block wasn't a number type
    if (block.type !== 'number' && prevType === 'number') {
      numberIndex = 1;
    }

    const c = htmlToMarkdown(block.content || '');

    switch (block.type) {
      case 'text':
        md += `${c}\n\n`;
        break;

      case 'h1':
        md += `# ${c}\n\n`;
        break;

      case 'h2':
        md += `## ${c}\n\n`;
        break;

      case 'h3':
        md += `### ${c}\n\n`;
        break;

      case 'bullet':
        md += `- ${c}\n`;
        break;

      case 'number':
        md += `${numberIndex}. ${c}\n`;
        numberIndex++;
        break;

      case 'todo': {
        const checkbox = block.checked ? '[x]' : '[ ]';
        md += `- ${checkbox} ${c}\n`;
        break;
      }

      case 'quote':
        md += `> ${c}\n\n`;
        break;

      case 'callout':
        md += `> ${c}\n\n`;
        break;

      case 'code':
        md += `\`\`\`\n${block.content || ''}\n\`\`\`\n\n`;
        break;

      case 'mermaid':
        md += `\`\`\`mermaid\n${block.content || ''}\n\`\`\`\n\n`;
        break;

      case 'divider':
        md += `---\n\n`;
        break;

      case 'table': {
        try {
          const data = JSON.parse(block.content || '{}');
          const headers = data.headers || [];
          const rows = data.rows || [];

          if (headers.length > 0) {
            md += `| ${headers.join(' | ')} |\n`;
            md += `| ${headers.map(() => '---').join(' | ')} |\n`;
            for (const row of rows) {
              const cells = headers.map((_, i) => row[i] || '');
              md += `| ${cells.join(' | ')} |\n`;
            }
            md += '\n';
          }
        } catch {
          md += `${block.content || ''}\n\n`;
        }
        break;
      }

      case 'image': {
        const props = typeof block.props === 'string' ? JSON.parse(block.props || '{}') : (block.props || {});
        const caption = props.caption || '';
        const src = block.content || '';

        if (src.length > 50000) {
          md += `![${caption}][image]\n\n`;
        } else {
          md += `![${caption}](${src})\n\n`;
        }
        break;
      }

      case 'mention': {
        const props = typeof block.props === 'string' ? JSON.parse(block.props || '{}') : (block.props || {});
        const title = props.page_title || 'Untitled';
        md += `[[${title}]]\n\n`;
        break;
      }

      case 'file': {
        const fprops = typeof block.props === 'string' ? JSON.parse(block.props || '{}') : (block.props || {});
        const fname = fprops.file_name || 'attachment';
        const fsize = fprops.file_size || 0;
        const fmime = fprops.mime_type || '';
        const sizeStr = fsize < 1024 ? `${fsize} B`
          : fsize < 1024 * 1024 ? `${(fsize / 1024).toFixed(1)} KB`
          : `${(fsize / (1024 * 1024)).toFixed(1)} MB`;
        md += `[${fname}](attachments/${fname}) (${sizeStr}, ${fmime || 'file'})\n\n`;
        break;
      }

      case 'excalidraw':
        md += `\`\`\`excalidraw\n${block.content || '{}'}\n\`\`\`\n\n`;
        break;

      default:
        md += `${c}\n\n`;
        break;
    }

    prevType = block.type;
  }

  // Append database data if provided
  if (database && database.schema && database.rows) {
    const schema = database.schema;
    const dbRows = database.rows;
    if (schema.length > 0 && dbRows.length > 0) {
      md += '\n\n';
      if (database.name) {
        md += `## ${database.name}\n\n`;
      }
      const headers = schema.map((col) => col.name);
      md += `| ${headers.join(' | ')} |\n`;
      md += `| ${headers.map(() => '---').join(' | ')} |\n`;
      for (const row of dbRows) {
        const props = typeof row.properties === 'string'
          ? JSON.parse(row.properties || '{}')
          : row.properties || {};
        const cells = schema.map((col) => {
          const val = props[col.id];
          if (val === true) return 'Yes';
          if (val === false) return 'No';
          return String(val || '');
        });
        md += `| ${cells.join(' | ')} |\n`;
      }
      md += '\n';
    }
  }

  // Add extra newline after list groups
  return md.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/**
 * Converts an array of blocks to a formatted HTML string.
 * Includes inline styles so formatting survives paste into other apps.
 */
export function blocksToHtml(blocks, pageTitle, database) {
  const fontStyle = 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; color: rgb(55, 53, 47); line-height: 1.5;';
  let html = `<div style="${fontStyle} max-width: 708px;">`;

  if (pageTitle) {
    html += `<h1 style="font-size: 40px; font-weight: 700; margin-bottom: 4px;">${escapeHtml(pageTitle)}</h1>`;
  }

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    // Group consecutive bullet items
    if (block.type === 'bullet') {
      html += '<ul style="margin: 4px 0; padding-left: 24px;">';
      while (i < blocks.length && blocks[i].type === 'bullet') {
        html += `<li style="font-size: 16px;">${escapeHtml(blocks[i].content || '')}</li>`;
        i++;
      }
      html += '</ul>';
      continue;
    }

    // Group consecutive number items
    if (block.type === 'number') {
      html += '<ol style="margin: 4px 0; padding-left: 24px;">';
      while (i < blocks.length && blocks[i].type === 'number') {
        html += `<li style="font-size: 16px;">${escapeHtml(blocks[i].content || '')}</li>`;
        i++;
      }
      html += '</ol>';
      continue;
    }

    switch (block.type) {
      case 'text':
        html += `<p style="font-size: 16px; margin: 2px 0;">${escapeHtml(block.content || '') || '<br>'}</p>`;
        break;

      case 'h1':
        html += `<h1 style="font-size: 30px; font-weight: 700; margin: 20px 0 4px;">${escapeHtml(block.content || '')}</h1>`;
        break;

      case 'h2':
        html += `<h2 style="font-size: 24px; font-weight: 600; margin: 18px 0 4px;">${escapeHtml(block.content || '')}</h2>`;
        break;

      case 'h3':
        html += `<h3 style="font-size: 20px; font-weight: 600; margin: 16px 0 4px;">${escapeHtml(block.content || '')}</h3>`;
        break;

      case 'todo': {
        const check = block.checked ? '\u2611' : '\u2610';
        const textStyle = block.checked ? 'text-decoration: line-through; color: rgba(55,53,47,0.45);' : '';
        html += `<div style="font-size: 16px; margin: 2px 0; ${textStyle}">${check} ${escapeHtml(block.content || '')}</div>`;
        break;
      }

      case 'quote':
        html += `<blockquote style="margin: 4px 0; padding-left: 14px; border-left: 3px solid rgb(55,53,47); font-size: 16px;">${escapeHtml(block.content || '')}</blockquote>`;
        break;

      case 'callout':
        html += `<div style="background: rgba(241,241,239,0.6); border-radius: 4px; padding: 12px 16px; margin: 4px 0; font-size: 16px; display: flex; gap: 8px;">\ud83d\udca1 ${escapeHtml(block.content || '')}</div>`;
        break;

      case 'code':
        html += `<pre style="background: rgba(135,131,120,0.15); border-radius: 4px; padding: 12px 16px; margin: 4px 0; overflow-x: auto;"><code style="font-family: iawriter-mono, Nitti, Menlo, Courier, monospace; font-size: 14px;">${escapeHtml(block.content || '')}</code></pre>`;
        break;

      case 'mermaid':
        html += `<pre style="background: rgba(135,131,120,0.15); border-radius: 4px; padding: 12px 16px; margin: 4px 0; overflow-x: auto;"><code class="language-mermaid" style="font-family: iawriter-mono, Nitti, Menlo, Courier, monospace; font-size: 14px;">${escapeHtml(block.content || '')}</code></pre>`;
        break;

      case 'divider':
        html += `<hr style="border: none; border-top: 1px solid rgba(55,53,47,0.09); margin: 8px 0;">`;
        break;

      case 'table': {
        try {
          const data = JSON.parse(block.content || '{}');
          const headers = data.headers || [];
          const rows = data.rows || [];

          if (headers.length > 0) {
            html += '<table style="width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 16px;">';
            html += '<thead><tr>';
            for (const h of headers) {
              html += `<th style="border: 1px solid rgba(55,53,47,0.09); padding: 6px 10px; background: rgba(55,53,47,0.04); font-weight: 600; text-align: left;">${escapeHtml(h)}</th>`;
            }
            html += '</tr></thead><tbody>';
            for (const row of rows) {
              html += '<tr>';
              for (let c = 0; c < headers.length; c++) {
                html += `<td style="border: 1px solid rgba(55,53,47,0.09); padding: 6px 10px;">${escapeHtml(row[c] || '')}</td>`;
              }
              html += '</tr>';
            }
            html += '</tbody></table>';
          }
        } catch {
          html += `<p style="font-size: 16px;">${escapeHtml(block.content || '')}</p>`;
        }
        break;
      }

      case 'image': {
        const props = typeof block.props === 'string' ? JSON.parse(block.props || '{}') : (block.props || {});
        const caption = props.caption || '';
        const src = block.content || '';
        const align = props.align || 'center';
        html += `<div style="text-align: ${align}; margin: 8px 0;">`;
        if (src) {
          html += `<img src="${src}" alt="${escapeHtml(caption)}" style="max-width: 100%; border-radius: 4px;">`;
        }
        if (caption) {
          html += `<div style="font-size: 14px; color: rgba(55,53,47,0.45); text-align: center; margin-top: 6px;">${escapeHtml(caption)}</div>`;
        }
        html += '</div>';
        break;
      }

      case 'mention': {
        const props = typeof block.props === 'string' ? JSON.parse(block.props || '{}') : (block.props || {});
        const title = props.page_title || 'Untitled';
        const icon = props.page_icon || '\ud83d\udcc4';
        html += `<div style="display: inline-block; background: rgba(35,131,226,0.08); border-radius: 4px; padding: 2px 6px; margin: 2px 0; font-size: 16px;">${icon} ${escapeHtml(title)}</div>`;
        break;
      }

      case 'file': {
        const fprops = typeof block.props === 'string' ? JSON.parse(block.props || '{}') : (block.props || {});
        const fname = fprops.file_name || 'attachment';
        const fsize = fprops.file_size || 0;
        const fmime = fprops.mime_type || '';
        const sizeStr = fsize < 1024 ? `${fsize} B`
          : fsize < 1024 * 1024 ? `${(fsize / 1024).toFixed(1)} KB`
          : `${(fsize / (1024 * 1024)).toFixed(1)} MB`;
        const fileSrc = block.content || '#';
        html += `<div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid rgba(55,53,47,0.09); border-radius: 4px; margin: 4px 0; font-size: 14px;">`;
        html += `<span style="font-size: 20px;">\uD83D\uDCCE</span>`;
        html += `<div><a href="${fileSrc}" download="${escapeHtml(fname)}" style="color: rgb(35,131,226); text-decoration: none; font-weight: 500;">${escapeHtml(fname)}</a>`;
        html += `<div style="color: rgba(55,53,47,0.45); font-size: 12px;">${sizeStr}${fmime ? ' \u2022 ' + escapeHtml(fmime.split('/').pop().toUpperCase()) : ''}</div></div></div>`;
        break;
      }

      case 'excalidraw':
        html += `<div style="border: 1px solid rgba(55,53,47,0.09); border-radius: 6px; padding: 16px; margin: 4px 0; text-align: center; color: rgba(55,53,47,0.45); font-size: 14px;">[Excalidraw Drawing]</div>`;
        break;

      default:
        html += `<p style="font-size: 16px; margin: 2px 0;">${escapeHtml(block.content || '')}</p>`;
        break;
    }

    i++;
  }

  // Append database data if provided
  if (database && database.schema && database.rows) {
    const schema = database.schema;
    const dbRows = database.rows;
    if (schema.length > 0 && dbRows.length > 0) {
      if (database.name) {
        html += `<h2 style="font-size: 24px; font-weight: 600; margin: 24px 0 8px;">${escapeHtml(database.name)}</h2>`;
      }
      html += '<table style="width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 16px;">';
      html += '<thead><tr>';
      for (const col of schema) {
        html += `<th style="border: 1px solid rgba(55,53,47,0.09); padding: 6px 10px; background: rgba(55,53,47,0.04); font-weight: 600; text-align: left;">${escapeHtml(col.name)}</th>`;
      }
      html += '</tr></thead><tbody>';
      for (const row of dbRows) {
        const props = typeof row.properties === 'string'
          ? JSON.parse(row.properties || '{}')
          : row.properties || {};
        html += '<tr>';
        for (const col of schema) {
          const val = props[col.id];
          let display = '';
          if (val === true) display = 'Yes';
          else if (val === false) display = 'No';
          else display = String(val || '');
          html += `<td style="border: 1px solid rgba(55,53,47,0.09); padding: 6px 10px;">${escapeHtml(display)}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
    }
  }

  html += '</div>';
  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sanitizes a filename for download.
 */
function sanitizeFilename(filename) {
  return (filename || 'untitled')
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/**
 * Downloads a Markdown string as a .md file.
 */
export function downloadMarkdown(markdown, filename) {
  const sanitized = sanitizeFilename(filename);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitized}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Converts a base64 data URL to a Uint8Array of raw bytes.
 */
function dataURLToBytes(dataURL) {
  const base64 = dataURL.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Downloads Markdown + file attachments as a .zip file.
 * File blocks are extracted into an attachments/ folder and
 * the Markdown references them with relative paths.
 * Falls back to plain .md download if there are no file blocks.
 */
export async function downloadMarkdownWithAttachments(markdown, blocks, filename) {
  const fileBlocks = blocks.filter((b) => b.type === 'file' && b.content);

  // No file blocks — just download the .md
  if (fileBlocks.length === 0) {
    downloadMarkdown(markdown, filename);
    return;
  }

  const sanitized = sanitizeFilename(filename);
  const zip = new JSZip();
  const attachmentsFolder = zip.folder('attachments');

  // Add the markdown file at the root
  zip.file(`${sanitized}.md`, markdown);

  // Track filenames to handle duplicates
  const usedNames = new Set();

  for (const block of fileBlocks) {
    const props = typeof block.props === 'string'
      ? JSON.parse(block.props || '{}')
      : (block.props || {});
    let fname = props.file_name || 'attachment';

    // Deduplicate filenames
    if (usedNames.has(fname)) {
      const dotIdx = fname.lastIndexOf('.');
      const base = dotIdx > 0 ? fname.slice(0, dotIdx) : fname;
      const ext = dotIdx > 0 ? fname.slice(dotIdx) : '';
      let counter = 1;
      while (usedNames.has(`${base}-${counter}${ext}`)) counter++;
      fname = `${base}-${counter}${ext}`;
    }
    usedNames.add(fname);

    const bytes = dataURLToBytes(block.content);
    attachmentsFolder.file(fname, bytes);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitized}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Escapes a CSV field value. Wraps in double quotes if the value contains
 * commas, double quotes, or newlines. Internal double quotes are doubled.
 */
function escapeCSVField(value) {
  const str = String(value || '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Converts table blocks to CSV format.
 * If no tables exist, exports all blocks as single-column CSV (one row per block).
 */
export function exportTableToCSV(blocks, pageTitle, database) {
  // If database data is provided, export it as CSV
  if (database && database.schema && database.rows && database.rows.length > 0) {
    const schema = database.schema;
    const lines = [];
    lines.push(schema.map((col) => escapeCSVField(col.name)).join(','));
    for (const row of database.rows) {
      const props = typeof row.properties === 'string'
        ? JSON.parse(row.properties || '{}')
        : row.properties || {};
      const cells = schema.map((col) => {
        const val = props[col.id];
        if (val === true) return escapeCSVField('Yes');
        if (val === false) return escapeCSVField('No');
        return escapeCSVField(String(val || ''));
      });
      lines.push(cells.join(','));
    }
    return lines.join('\n');
  }

  const tableBlocks = blocks.filter((b) => b.type === 'table');

  if (tableBlocks.length > 0) {
    const csvParts = [];
    for (const block of tableBlocks) {
      try {
        const data = JSON.parse(block.content || '{}');
        const headers = data.headers || [];
        const rows = data.rows || [];
        const lines = [];

        if (headers.length > 0) {
          lines.push(headers.map(escapeCSVField).join(','));
          for (const row of rows) {
            const cells = headers.map((_, i) => escapeCSVField(row[i] || ''));
            lines.push(cells.join(','));
          }
        }
        csvParts.push(lines.join('\n'));
      } catch {
        // Skip malformed table blocks
      }
    }
    return csvParts.join('\n\n');
  }

  // No tables: export all blocks as single-column CSV
  const lines = [];
  if (pageTitle) {
    lines.push(escapeCSVField(pageTitle));
  }
  for (const block of blocks) {
    if (block.type === 'divider') {
      lines.push('---');
    } else {
      const content = (block.content || '').replace(/<[^>]+>/g, '');
      lines.push(escapeCSVField(content));
    }
  }
  return lines.join('\n');
}

/**
 * Downloads a CSV string as a .csv file.
 */
export function downloadCSV(csvString, title) {
  const sanitized = sanitizeFilename(title);
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitized}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens a print dialog with styled HTML content for PDF export.
 * The user can choose "Save as PDF" from the browser print dialog.
 */
export function downloadPDF(blocks, pageTitle, database) {
  const htmlContent = blocksToHtml(blocks, pageTitle, database);

  const printCSS = `
    @media print {
      body { margin: 0; padding: 20mm; }
      img { max-width: 100% !important; page-break-inside: avoid; }
      table { page-break-inside: avoid; }
      h1, h2, h3 { page-break-after: avoid; }
      pre { white-space: pre-wrap; word-wrap: break-word; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
      color: rgb(55, 53, 47);
      line-height: 1.5;
      max-width: 708px;
      margin: 0 auto;
      padding: 40px 20px;
    }
  `;

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtmlForPDF(pageTitle || 'Untitled')}</title>
  <style>${printCSS}</style>
</head>
<body>
  ${htmlContent}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 250);
    };
  <\/script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(fullHtml);
    printWindow.document.close();
  }
}

function escapeHtmlForPDF(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
