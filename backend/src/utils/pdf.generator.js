import PDFDocument from 'pdfkit';

// ─── PALETA ───────────────────────────────────────────────────────────────────
const COLOR = {
  primario: '#1a3a5c',   // azul oscuro
  acento: '#2563eb',     // azul
  texto: '#1f2937',
  gris: '#6b7280',
  grisClar: '#f3f4f6',
  blanco: '#ffffff',
  verde: '#16a34a',
  rojo: '#dc2626',
  naranja: '#d97706',
};

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtNum = (n) => Number(n || 0).toLocaleString('es-PA');

// ─── CLASE GENERADORA ─────────────────────────────────────────────────────────

export class PdfGenerator {
  constructor(res, titulo, firma) {
    this.doc = new PDFDocument({ size: 'A4', margin: 45, bufferPages: true });
    this.res = res;
    this.titulo = titulo;
    this.firma = firma;
    this.pageNum = 0;

    // Pipe directo al response HTTP
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${titulo.replace(/\s+/g, '_')}.pdf"`);
    this.doc.pipe(res);

    this.doc.on('pageAdded', () => {
      this.pageNum++;
      if (this.pageNum > 1) this._encabezadoContinuacion();
    });
  }

  // ─── PÁGINA ─────────────────────────────────────────────────────────────────

  _encabezadoPrincipal(periodo) {
    const { doc } = this;
    const W = doc.page.width - 90;

    // Barra superior
    doc.rect(45, 45, W, 52).fill(COLOR.primario);

    // Nombre de la firma
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(COLOR.blanco)
      .text(this.firma?.nombre || 'GESTARLEX', 60, 55, { width: W - 20 });

    // RUC
    if (this.firma?.ruc) {
      doc.font('Helvetica').fontSize(8).fillColor('#93c5fd')
        .text(`RUC: ${this.firma.ruc}`, 60, 72);
    }

    // GESTARLEX badge (derecha)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR.blanco)
      .text('GESTARLEX', 60, 57, { width: W - 20, align: 'right' });

    doc.moveDown(0.3);
    doc.y = 110;

    // Título del reporte
    doc.font('Helvetica-Bold').fontSize(17).fillColor(COLOR.primario)
      .text(this.titulo, 45, doc.y, { align: 'center', width: W });

    // Período
    if (periodo) {
      doc.font('Helvetica').fontSize(9).fillColor(COLOR.gris)
        .text(
          `Período: ${periodo.desde}  al  ${periodo.hasta}    •    Generado: ${new Date().toLocaleDateString('es-PA')}`,
          45, doc.y + 4, { align: 'center', width: W }
        );
    }

    // Línea separadora
    doc.moveDown(0.8);
    doc.moveTo(45, doc.y).lineTo(45 + W, doc.y).lineWidth(1.5).strokeColor(COLOR.acento).stroke();
    doc.moveDown(0.6);
  }

  _encabezadoContinuacion() {
    const { doc } = this;
    const W = doc.page.width - 90;
    doc.rect(45, 45, W, 26).fill(COLOR.primario);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR.blanco)
      .text(this.firma?.nombre || 'GESTARLEX', 55, 52)
      .text(this.titulo, 55, 52, { width: W - 20, align: 'right' });
    doc.y = 82;
  }

  _pie() {
    const { doc } = this;
    const W = doc.page.width - 90;
    const range = doc.bufferedPageRange();

    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const y = doc.page.height - 35;
      doc.moveTo(45, y).lineTo(45 + W, y).lineWidth(0.5).strokeColor(COLOR.gris).stroke();
      doc.font('Helvetica').fontSize(7).fillColor(COLOR.gris)
        .text('GESTARLEX — Software de Gestión para Firmas de Abogados en Panamá', 45, y + 6, { width: W * 0.6 })
        .text(`Página ${i + 1} de ${range.count}`, 45, y + 6, { width: W, align: 'right' });
    }
  }

  // ─── BLOQUES ────────────────────────────────────────────────────────────────

  subtitulo(texto) {
    const { doc } = this;
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR.primario).text(texto);
    doc.moveTo(45, doc.y + 2).lineTo(doc.page.width - 45, doc.y + 2)
      .lineWidth(0.5).strokeColor(COLOR.acento).stroke();
    doc.moveDown(0.5);
  }

  kpiRow(kpis) {
    const { doc } = this;
    const W = doc.page.width - 90;
    const n = kpis.length;
    const colW = Math.floor(W / n);
    const startX = 45;
    const startY = doc.y;
    const h = 44;

    kpis.forEach((kpi, i) => {
      const x = startX + i * colW;
      doc.rect(x + 2, startY, colW - 4, h).fill(COLOR.grisClar).stroke();
      doc.font('Helvetica-Bold').fontSize(16).fillColor(kpi.color || COLOR.acento)
        .text(kpi.valor, x + 2, startY + 6, { width: colW - 4, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.gris)
        .text(kpi.etiqueta, x + 2, startY + 28, { width: colW - 4, align: 'center' });
    });

    doc.y = startY + h + 10;
  }

  tabla(columnas, filas, opciones = {}) {
    const { doc } = this;
    const W = doc.page.width - 90;
    const startX = 45;
    const totalProporciones = columnas.reduce((s, c) => s + (c.ancho || 1), 0);
    const alturaFila = opciones.alturaFila || 18;
    const alturaHeader = 22;

    // Calcular anchos reales
    const anchos = columnas.map((c) => ((c.ancho || 1) / totalProporciones) * W);

    // Verificar si cabe en la página
    const espacioNecesario = alturaHeader + filas.length * alturaFila + 10;
    if (doc.y + espacioNecesario > doc.page.height - 60) {
      doc.addPage();
    }

    let y = doc.y;

    // Header
    doc.rect(startX, y, W, alturaHeader).fill(COLOR.primario);
    let x = startX;
    columnas.forEach((col, i) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.blanco)
        .text(col.titulo, x + 4, y + 6, { width: anchos[i] - 8, align: col.alineacion || 'left' });
      x += anchos[i];
    });
    y += alturaHeader;

    // Filas
    filas.forEach((fila, rowIdx) => {
      // Salto de página si no cabe
      if (y + alturaFila > doc.page.height - 60) {
        doc.addPage();
        y = doc.y;
        // Repetir header
        doc.rect(startX, y, W, alturaHeader).fill(COLOR.primario);
        let hx = startX;
        columnas.forEach((col, i) => {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.blanco)
            .text(col.titulo, hx + 4, y + 6, { width: anchos[i] - 8, align: col.alineacion || 'left' });
          hx += anchos[i];
        });
        y += alturaHeader;
      }

      const bgColor = rowIdx % 2 === 0 ? COLOR.blanco : COLOR.grisClar;
      doc.rect(startX, y, W, alturaFila).fill(bgColor).stroke();

      x = startX;
      columnas.forEach((col, i) => {
        const val = fila[col.campo] ?? '';
        const color = col.colorFn ? col.colorFn(val, fila) : COLOR.texto;
        doc.font('Helvetica').fontSize(8).fillColor(color)
          .text(String(val), x + 4, y + 4, {
            width: anchos[i] - 8,
            align: col.alineacion || 'left',
            lineBreak: false,
          });
        x += anchos[i];
      });
      y += alturaFila;
    });

    // Borde inferior
    doc.rect(startX, doc.y - (filas.length % 1) * alturaFila, W, 0)
      .lineWidth(0.5).strokeColor(COLOR.gris).stroke();

    doc.y = y + 8;
  }

  filaTotales(columnas, totales) {
    const { doc } = this;
    const W = doc.page.width - 90;
    const startX = 45;
    const totalProporciones = columnas.reduce((s, c) => s + (c.ancho || 1), 0);
    const anchos = columnas.map((c) => ((c.ancho || 1) / totalProporciones) * W);
    const h = 22;
    const y = doc.y - 4;

    doc.rect(startX, y, W, h).fill(COLOR.primario);
    let x = startX;
    columnas.forEach((col, i) => {
      const val = totales[col.campo] !== undefined ? totales[col.campo] : (col.totalLabel || '');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR.blanco)
        .text(String(val), x + 4, y + 6, { width: anchos[i] - 8, align: col.alineacion || 'left' });
      x += anchos[i];
    });
    doc.y = y + h + 10;
  }

  parrafo(texto) {
    this.doc.font('Helvetica').fontSize(9).fillColor(COLOR.texto).text(texto);
    this.doc.moveDown(0.4);
  }

  espacio(n = 1) {
    this.doc.moveDown(n);
  }

  finalizar() {
    this._pie();
    this.doc.end();
  }
}
