import { adminRoute } from './_respond.js'
import { fetchDrivePhoto, requireAdmin } from '../../server/admin.js'
import { indexPhoto } from '../../server/matcher.js'

/** { password, id } -> { w, h, faces: [base64 signature] } for one Drive photo. */
export default adminRoute(async ({ password, id }) => {
  requireAdmin(password)
  const buffer = await fetchDrivePhoto(id)
  return indexPhoto(buffer)
})
