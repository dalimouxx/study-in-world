import { apiBaseUrl, getAccessToken } from './api';

/**
 * Télécharge un fichier depuis l'API (export Excel/PDF, etc.) — un simple lien ne suffit pas, la route
 * exige le jeton d'authentification comme toutes les autres routes admin.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${apiBaseUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error(`download_failed_${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
