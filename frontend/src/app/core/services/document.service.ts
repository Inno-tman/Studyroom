import { Injectable } from '@angular/core';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { jsPDF } from 'jspdf';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private parseContent(text: string): { type: 'heading' | 'paragraph' | 'empty'; level?: number; text: string }[] {
    return text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return { type: 'empty', text: '' };
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) return { type: 'heading', level: headingMatch[1].length, text: headingMatch[2] };
      const boldMatch = trimmed.match(/^\*\*(.+)\*\*$/);
      if (boldMatch) return { type: 'heading', level: 2, text: boldMatch[1] };
      return { type: 'paragraph', text: trimmed };
    });
  }

  private stripBold(text: string): string {
    return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
  }

  async downloadDocx(title: string, content: string, filename: string = 'document.docx'): Promise<void> {
    const blocks = this.parseContent(content);
    const children: Paragraph[] = [];

    children.push(new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 28, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }));

    children.push(new Paragraph({
      children: [new TextRun({ text: '', size: 22, font: 'Calibri' })],
      spacing: { after: 200 }
    }));

    for (const block of blocks) {
      if (block.type === 'empty') {
        children.push(new Paragraph({ spacing: { after: 100 } }));
        continue;
      }
      if (block.type === 'heading') {
        const headingSize = block.level === 1 ? 28 : block.level === 2 ? 24 : 22;
        children.push(new Paragraph({
          children: [new TextRun({ text: block.text, bold: true, size: headingSize, font: 'Calibri' })],
          spacing: { before: 300, after: 100 },
          heading: block.level === 1 ? HeadingLevel.HEADING_1 : block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
        }));
        continue;
      }
      const runs: TextRun[] = [];
      let remaining = block.text;
      const boldPattern = /\*\*(.+?)\*\*/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = boldPattern.exec(remaining)) !== null) {
        if (match.index > lastIndex) {
          runs.push(new TextRun({ text: remaining.slice(lastIndex, match.index), size: 22, font: 'Calibri' }));
        }
        runs.push(new TextRun({ text: match[1], bold: true, size: 22, font: 'Calibri' }));
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < remaining.length) {
        runs.push(new TextRun({ text: remaining.slice(lastIndex), size: 22, font: 'Calibri' }));
      }
      children.push(new Paragraph({
        children: runs.length > 0 ? runs : [new TextRun({ text: block.text, size: 22, font: 'Calibri' })],
        spacing: { after: 120 }
      }));
    }

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    this.downloadBlob(blob, filename);
  }

  downloadPdf(title: string, content: string, filename: string = 'document.pdf'): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(title, maxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 7 + 10;

    const blocks = this.parseContent(content);
    for (const block of blocks) {
      if (block.type === 'empty') {
        y += 5;
        continue;
      }
      if (block.type === 'heading') {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFontSize(block.level === 1 ? 14 : 12);
        doc.setFont('helvetica', 'bold');
        const lines = doc.splitTextToSize(block.text, maxWidth);
        doc.text(lines, margin, y);
        y += lines.length * 6 + 5;
        continue;
      }
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const text = this.stripBold(block.text);
      const lines = doc.splitTextToSize(text, maxWidth);
      if (lines.length > 1 && y + lines.length * 5 > 270) { doc.addPage(); y = 20; }
      doc.text(lines, margin, y);
      y += lines.length * 5 + 2;
    }

    doc.save(filename);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
