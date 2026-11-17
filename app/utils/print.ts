import type { DocumentNode, ExportBatch, Paper } from '~~/shared/project';
import { generateHTML, getSchema } from '@tiptap/core';
import QRCode from 'qrcode';
import { formatSerial, qrPayload } from '~~/shared/project';
import { ballotExtensions } from './ballot-extensions';

export function validateDocument(content: DocumentNode) {
  getSchema(ballotExtensions()).nodeFromJSON(content).check();
}

export function paperDimensions(paper: Paper): [number, number] {
  const dimensions: [number, number] = paper.size === 'A4'
    ? [210, 297]
    : [148, 210];
  return paper.orientation === 'landscape'
    ? [dimensions[1], dimensions[0]]
    : dimensions;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
  })[char]!);
}

export async function renderPrintDocument(batch: ExportBatch): Promise<string> {
  validateDocument(batch.document);
  const base = generateHTML(batch.document, ballotExtensions());
  const pages: string[] = [];
  for (const ballot of batch.ballots) {
    const container = document.createElement('div');
    container.innerHTML = base; // Generated exclusively by our validated Tiptap schema.
    container.querySelectorAll('[data-ballot-number]').forEach((node) => {
      node.textContent = node.getAttribute('data-ballot-number') === 'serial'
        ? formatSerial(ballot.serial)
        : ballot.unique;
    });
    if (container.querySelector('[data-ballot-qr]')) {
      const svg = await QRCode.toString(qrPayload(batch.guid, ballot), {
        type: 'svg',
        margin: 4,
        width: 120,
        errorCorrectionLevel: 'M',
      });
      container.querySelectorAll('[data-ballot-qr]').forEach((node) => {
        node.innerHTML = svg;
      });
    }
    pages.push(`<article class="ballot-content" data-serial="${ballot.serial}">${container.innerHTML}</article>`);
    if (pages.length % 25 === 0)
      await new Promise(resolve => setTimeout(resolve, 0));
  }
  const [width, height] = paperDimensions(batch.paper);
  const stylesheet = await import('~/assets/print.css?inline');
  const css = `${stylesheet.default}
:root {
  --paper-width: ${width}mm;
  --paper-height: ${height}mm;
  --paper-margin: ${batch.paper.margin}mm;
}
@page {
  size: ${width}mm ${height}mm;
  margin: ${batch.paper.margin}mm;
}
`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${
    escapeHtml(batch.title)} · ${batch.ballots.length} 份选票</title><style>${css}</style></head><body>`
    + `<div class="print-help">${batch.ballots.length} 份选票 · ${batch.paper.size
    } · 使用 Ctrl / ⌘ + P 打印或另存为 PDF。请关闭浏览器页眉和页脚，缩放设为 100%。</div>${pages.join('')}</body></html>`;
}

export function downloadFile(contents: string, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function safeFilename(title: string): string {
  return Array.from(title, char => char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char)
    ? '_'
    : char).join('').slice(0, 100) || '未命名投票';
}
