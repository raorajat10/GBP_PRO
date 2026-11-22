import "server-only";
import QRCode from "qrcode";

/** QR code as an SVG string (dark modules on transparent), for inline display and print. */
export async function qrSvg(text: string, color = "#000000"): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: color, light: "#0000" },
  });
}

/** QR code as a PNG data URL, for a "Download QR" link. */
export async function qrPngDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 2, width: 1024, errorCorrectionLevel: "M" });
}
