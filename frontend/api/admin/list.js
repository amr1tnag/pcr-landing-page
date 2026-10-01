import { adminRoute } from './_respond.js'
import { configured, listFolder, parseFolderId, requireAdmin, AdminError } from '../../server/admin.js'

/** { password } -> setup status; { password, folder } -> { folderId, files: [{ id, name }] } */
export default adminRoute(async ({ password, folder }) => {
  requireAdmin(password)
  if (!folder) return { ok: true, configured: configured() }
  const folderId = parseFolderId(folder)
  if (!folderId) throw new AdminError(400, "That doesn't look like a Google Drive folder link.")
  const files = await listFolder(folderId)
  if (!files.length) throw new AdminError(404, 'No photos found in that folder. Is it the right folder, shared as "Anyone with the link"?')
  return { folderId, files }
})
