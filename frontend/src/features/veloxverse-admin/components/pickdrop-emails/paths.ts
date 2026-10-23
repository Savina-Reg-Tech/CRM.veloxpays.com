// Routes for the Pick & Drop customer-email screens.
export const PD_EMAILS_BASE = '/dashboard/veloxverse/pickdrop/emails'
export const draftPath = (id: string) => `${PD_EMAILS_BASE}/drafts/${encodeURIComponent(id)}`
export const TEMPLATES_BASE = '/dashboard/veloxverse/settings/email-templates'
export const templatePath = (key: string) => `${TEMPLATES_BASE}/${encodeURIComponent(key)}`
/** The Pick & Drop bookings page, opened on one booking. */
export const bookingPath = (orderNo: string) => `/dashboard/veloxverse/transfers?orderNo=${encodeURIComponent(orderNo)}`
/** The inbox tab with one email's drawer open. */
export const inboxEmailPath = (id: string) => `${PD_EMAILS_BASE}/inbox?email=${encodeURIComponent(id)}`
