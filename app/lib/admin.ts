import { env } from "cloudflare:workers";
import { isDeskAdmin } from "./admin-policy";
export function canManageDesk(headers: Headers) {
  return isDeskAdmin(headers, (env as unknown as {DESK_OWNER_SITE_ID?: string}).DESK_OWNER_SITE_ID);
}
