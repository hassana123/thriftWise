import { formatMoney, formatDate } from "@/lib/format";
import { buildLedger, LEDGER_STATUS_META, type LedgerStatus } from "@/domain/ledger";
import type { ThriftState } from "@/domain/types";

const STATUS_COLORS: Record<LedgerStatus, string> = {
  paid: "#059669",
  review: "#d97706",
  pending: "#64748b",
  missed: "#dc2626",
  future: "#cbd5e1",
};

const STATUS_BG: Record<LedgerStatus, string> = {
  paid: "#d1fae5",
  review: "#fef3c7",
  pending: "#f1f5f9",
  missed: "#fee2e2",
  future: "#f8fafc",
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Renders the full contribution ledger to a PNG data URL using the Canvas 2D
// API. Drawing directly avoids the CSS-serialisation issues that break DOM
// screenshots (Tailwind v4 oklch colours, web fonts, off-screen layout).
export async function renderLedgerImage(state: ThriftState): Promise<string> {
  const ledger = buildLedger(state);
  const pad = 32;
  const nameCol = 220;
  const cellW = 52;
  const rowH = 44;
  const headerH = 96;
  const footerH = 64;

  const weeks = ledger.weeks;
  const rows = ledger.rows;

  const width = pad * 2 + nameCol + Math.max(weeks.length, 1) * cellW;
  const height = headerH + rows.length * rowH + footerH + pad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = "#0f172a";
  ctx.font = `bold 22px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(state.settings.name, pad, 34);

  ctx.fillStyle = "#64748b";
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText(
    `Family Contribution Ledger · ${formatDate(new Date().toISOString(), "MMM d, yyyy")}`,
    pad,
    60
  );

  // Column headers (weeks)
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#334155";
  const colX = (i: number) => pad + nameCol + i * cellW + cellW / 2;
  for (let i = 0; i < weeks.length; i += 1) {
    ctx.fillText(`W${weeks[i].number}`, colX(i), 80);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#334155";
  ctx.fillText("Member", pad, 80);

  // Separator under header
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 92);
  ctx.lineTo(width - pad, 92);
  ctx.stroke();

  // Rows
  const rowY = (i: number) => headerH + i * rowH;
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    const y = rowY(r);
    if (r % 2 === 1) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(pad, y, width - pad * 2, rowH);
    }

    // Member name
    ctx.fillStyle = "#0f172a";
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(row.member.name, pad, y + rowH / 2);

    // Status cell
    for (let c = 0; c < row.cells.length; c += 1) {
      const status = row.cells[c];
      const cx = colX(c);
      const cy = y + rowH / 2;

      // Circle background
      ctx.fillStyle = STATUS_BG[status];
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();

      // Symbol
      ctx.fillStyle = STATUS_COLORS[status];
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(LEDGER_STATUS_META[status].symbol, cx, cy + 1);
    }

    // Row separator
    ctx.strokeStyle = "#eef2f7";
    ctx.beginPath();
    ctx.moveTo(pad, y + rowH);
    ctx.lineTo(width - pad, y + rowH);
    ctx.stroke();
  }

  // Footer / legend
  const footerY = headerH + rows.length * rowH + pad;
  const legendItems = [
    { status: "paid" as LedgerStatus },
    { status: "review" as LedgerStatus },
    { status: "pending" as LedgerStatus },
    { status: "missed" as LedgerStatus },
    { status: "future" as LedgerStatus },
  ];
  let lx = pad;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const item of legendItems) {
    const meta = LEDGER_STATUS_META[item.status];
    ctx.fillStyle = STATUS_BG[item.status];
    ctx.beginPath();
    ctx.arc(lx + 7, footerY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = STATUS_COLORS[item.status];
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(meta.symbol, lx + 7, footerY + 1);
    ctx.textAlign = "left";
    ctx.fillStyle = "#475569";
    ctx.font = `500 11px ${FONT}`;
    ctx.fillText(meta.label, lx + 22, footerY);
    lx += 22 + ctx.measureText(meta.label).width + 20;
  }

  const totalConfirmed = state.payments
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  ctx.fillStyle = "#0f172a";
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(`Confirmed: ${formatMoney(totalConfirmed)}`, width - pad, footerY);

  return canvas.toDataURL("image/png");
}
