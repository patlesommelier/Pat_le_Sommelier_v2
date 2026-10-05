// Image du QR code d'un restaurant (fonctions pures, testables) : SVG pour l'écran, PNG 1200 px pour l'impression.
import QRCode from 'qrcode';

export const qrSvg = (url: string, couleur = '#24151A') =>
  QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: couleur, light: '#FFFFFF' } });

export const qrPng = (url: string) => QRCode.toBuffer(url, { type: 'png', margin: 2, width: 1200, errorCorrectionLevel: 'M' });
