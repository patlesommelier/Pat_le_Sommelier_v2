// Côté navigateur : réduction des photos avant l'envoi (inscription, relecture des prix du menu).

/**
 * Image réduite dans le navigateur avant l'envoi (1800 px, JPEG) : sous la limite de 6 Mo par requête de Netlify,
 * et assez nette pour que Pat lise la carte. Un PDF, ou un format que le navigateur ne sait pas décoder (HEIC), part tel quel.
 */
export async function reduire(f: File): Promise<File> {
  if (!f.type.startsWith('image/')) return f;
  try {
    const img = await createImageBitmap(f);
    const k = Math.min(1, 1800 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * k); canvas.height = Math.round(img.height * k);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    return blob && blob.size < f.size ? new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
  } catch {
    return f;
  }
}
