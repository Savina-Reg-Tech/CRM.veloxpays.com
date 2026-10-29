import { canAccess } from '@/config/routeAccess'
import type { UserRole } from '@/types'

export interface GuideLink {
  label: string
  to: string
}

export interface GuideTopic {
  /** Used in shareable links: <page>?guide=<id>. */
  id: string
  section: string
  title: string
  summary: string
  /** The topic's own page. Shown only to roles that can open it; none = everyone. */
  page?: string
  steps: string[]
  /** "Go to…" links; each is also hidden from roles that can't open it. */
  links: GuideLink[]
  /** Extra words for the guide search. */
  keywords?: string[]
}

// Steps quote the pages' real labels. Keep them in sync when a page's wording changes.
// Sections follow the sidebar. `keywords` only feed the guide's search box.
export const GUIDE_TOPICS: GuideTopic[] = [
  // ── Getting started ──────────────────────────────────────────────
  {
    id: 'getting-around',
    section: 'Getting started',
    title: 'Getting around the CRM',
    summary: 'The menu, notifications and this guide.',
    keywords: ['menu', 'sidebar', 'help', 'sign out', 'logout'],
    steps: [
      'Use the menu on the left (on a phone, tap the menu button at the top) to open any page. You only see the pages your role allows.',
      'The bell at the top shows notifications for you; a number means some are unread. Open it and choose "Mark all read" to clear them.',
      'Open your name at the top right for this Quick Guide, to replay the welcome tour, or to sign out.',
      'To share a topic with a colleague, open it here and choose "Copy link". Use the search box above to find a topic quickly.',
    ],
    links: [],
  },
  {
    id: 'dashboard',
    section: 'Getting started',
    title: 'Dashboard',
    summary: 'Today at a glance: team, VeloxVerse activity and top spenders.',
    page: '/dashboard/admin',
    keywords: ['home', 'overview', 'stats'],
    steps: [
      '"CRM Team" shows Total, Active and Inactive Users; "VeloxVerse" shows Active Users, Active eSIMs and Lounge & Benefit Bookings.',
      '"Recent CRM Users" lists the newest staff; "VeloxVerse Activity" the latest customer orders.',
      '"Top VeloxVerse Spenders" ranks customers by spend across all services.',
      'Use "Quick Access" or "Full analytics (multi-currency)" to jump to the detailed pages.',
    ],
    links: [{ label: 'Dashboard', to: '/dashboard/admin' }],
  },

  // ── CRM ──────────────────────────────────────────────────────────
  {
    id: 'staff',
    section: 'CRM',
    title: 'Users: your team and their roles',
    summary: 'Add staff, set their role, reset passwords, deactivate.',
    page: '/dashboard/employees',
    keywords: ['staff', 'employee', 'team', 'role', 'password', 'deactivate', 'add user'],
    steps: [
      'Open Users and choose "Add User". Fill in Full Name, Email Address and Password, pick a Role and choose "Create User". You can only give roles your own role is allowed to create.',
      'Search by name or email (this searches the page you are on).',
      'Use the ⋮ menu on a row for "Reset password" (set a new one in the dialog) or "Deactivate" / "Activate". Deactivating takes effect straight away.',
      'The main super admin shows "Protected account" and can\'t be deactivated.',
    ],
    links: [{ label: 'Users', to: '/dashboard/employees' }],
  },
  {
    id: 'customers',
    section: 'CRM',
    title: 'Customers',
    summary: 'CRM customer records — add, view, edit, delete.',
    page: '/dashboard/customers',
    keywords: ['customer', 'client', 'record', 'add customer', 'guest', 'registered'],
    steps: [
      'Open Customers and type in "Search by name, email, phone, city…".',
      'To add someone, choose "Add Customer", fill in the form and save.',
      'On a CRM record, choose "View" for the details, "Edit" to change them, or "Delete" to remove it (you will be asked to confirm).',
      'If you also see VeloxVerse accounts here (Guest / Registered badge), use the account filter to pick "Registered users" or "Guests". Opening one takes you to its App User page — they can\'t be edited or deleted from Customers.',
    ],
    links: [{ label: 'Customers', to: '/dashboard/customers' }],
  },
  {
    id: 'verification-review',
    section: 'CRM',
    title: 'Verification: approve staff documents',
    summary: 'Review uploaded documents and activate accounts.',
    page: '/dashboard/verification-review',
    keywords: ['kyc', 'documents', 'activate', 'approve', 'reject', 'suspend'],
    steps: [
      'Open Verification and pick "Employees", "Agents" or "Affiliates". Filter by Status or search by name, email or user ID.',
      'Choose "Review" on a user. Each document has "Approve" or "Reject" (a reason is required to reject).',
      'When all required documents are approved, choose "Activate account". "Suspend" pauses the account.',
      'The shield icon at the top shows how many verifications are pending.',
    ],
    links: [{ label: 'Verification', to: '/dashboard/verification-review?status=pending' }],
  },
  {
    id: 'approvals',
    section: 'CRM',
    title: 'Approvals: raise or review a request',
    summary: 'Operational requests that need sign-off.',
    page: '/dashboard/approvals',
    keywords: ['request', 'approve', 'reject', 'sign off'],
    steps: [
      'Open Approvals and choose "New request", fill in the details and "Submit".',
      'Tick "Only my requests" to see just yours; choose "View" to follow one.',
      'Admins can "Approve" or "Reject" (with an optional note), "Move to review", "Back to pending" or "Mark completed". "Cancel request" withdraws it.',
    ],
    links: [{ label: 'Approvals', to: '/dashboard/approvals' }],
  },
  {
    id: 'settings',
    section: 'CRM',
    title: 'Settings: check provider connections',
    summary: 'eSIM, DragonPass, VeloxAssist, Mint and email status.',
    page: '/dashboard/settings',
    keywords: ['provider', 'api', 'integration', 'test', 'mint', 'dragonpass', 'email configuration'],
    steps: [
      'Open Settings. Each provider card shows "Connected" / "Configured" or "Not configured".',
      'Use the test buttons — "Test eSIM API", "Test DragonPass API", "Test VeloxAssist API", "Check Mint configuration" — to check a connection now.',
      '"Send test email" checks that the CRM can send email.',
      '"Email templates" opens the Pick & Drop email wording.',
    ],
    links: [{ label: 'Settings', to: '/dashboard/settings' }],
  },

  // ── Form Builder ─────────────────────────────────────────────────
  {
    id: 'forms',
    section: 'Form Builder',
    title: 'Build a form',
    summary: 'Fields, steps, design and publishing.',
    page: '/dashboard/forms',
    keywords: ['form', 'builder', 'field', 'step', 'publish', 'template', 'design', 'lead capture'],
    steps: [
      'Open Form Builder and choose "New Form" (or "Edit" on an existing one). Give it a name.',
      'On "Build", drag fields in from "Fields" (Text Input, Email, Phone, Dropdown, File Upload…). Use "+ Add Step" for a multi-step form.',
      '"Design" sets colours, layout, corner radius and font; "Templates" saves or applies a colour set. "Logic" controls which step comes next.',
      'Settings → "General" sets the "Submit Label" and "Success Message"; "Notifications" emails you or the submitter; "Webhooks" sends submissions to another system.',
      'Choose "Preview" to try it. To go live, set the status to Published and choose "Save".',
    ],
    links: [{ label: 'Form Builder', to: '/dashboard/forms' }],
  },
  {
    id: 'forms-share',
    section: 'Form Builder',
    title: 'Put a form on a website, or take payment',
    summary: 'Embed code, public link, and what happens on submit.',
    page: '/dashboard/forms',
    keywords: ['embed', 'iframe', 'javascript', 'link', 'payment link', 'redirect', 'thank you'],
    steps: [
      'In Form Builder, choose "Embed code" on a form. Copy the "Public form URL", or the "iFrame Embed" / "JavaScript Embed" code for a website.',
      'In the builder, the last step "On Form Submit" decides what happens next: "Show thank-you message", or redirect to a page, a URL, a Meeting link or a Payment link.',
      'To take payment, choose "Redirect to a Payment link" and paste the link. Tick "Open in new tab" if needed.',
    ],
    links: [{ label: 'Form Builder', to: '/dashboard/forms' }],
  },
  {
    id: 'forms-submissions',
    section: 'Form Builder',
    title: 'Read submissions and form analytics',
    summary: 'What people sent, and how a form is doing.',
    page: '/dashboard/forms',
    keywords: ['submission', 'export', 'csv', 'analytics', 'report', 'pass'],
    steps: [
      'In Form Builder, choose "Submissions" on a form. Filter by status and choose "View data" on a row to see what was sent.',
      'For VeloxVerse forms, the expanded row also shows the "VeloxVerse pass" status and country.',
      '"Export CSV" downloads the submissions for a report.',
      '"Analytics" on a form shows totals and "Submissions — Last 30 Days".',
    ],
    links: [{ label: 'Form Builder', to: '/dashboard/forms' }],
  },
  {
    id: 'forms-leads',
    section: 'Form Builder',
    title: 'Leads, spam and blocked domains',
    summary: 'Sort leads and keep junk out.',
    page: '/dashboard/forms/leads',
    keywords: ['lead', 'spam', 'converted', 'review', 'blocked domain', 'mailinator'],
    steps: [
      'Open Leads ("View All Leads" in Form Builder). The status filter starts on Spam — switch it to All to see every lead.',
      'Search by email or name. Use the "Action" dropdown on a row to mark a lead Normal, Review, Spam or Converted.',
      'Open "Blocked Domains", enter a domain (e.g. mailinator.com) and choose "Block". Submissions from it are flagged as spam automatically. Use the bin icon to unblock.',
    ],
    links: [
      { label: 'Leads', to: '/dashboard/forms/leads' },
      { label: 'Blocked Domains', to: '/dashboard/forms/blocked-domains' },
    ],
  },

  // ── VeloxVerse services ──────────────────────────────────────────
  {
    id: 'esim',
    section: 'VeloxVerse services',
    title: 'eSIM Orders',
    summary: 'Find an order, suspend, cancel or refund an eSIM.',
    page: '/dashboard/veloxverse/esim-orders',
    keywords: ['esim', 'iccid', 'data', 'suspend', 'cancel', 'refund', 'qr'],
    steps: [
      'Open eSIM Orders and search by order no, ICCID, package or customer. "Not paid" marks unpaid orders.',
      'Choose "View" for the QR code, install information, data plan, customer, pricing and audit trail.',
      'Under "Actions": "Suspend" pauses the eSIM ("Unsuspend" restarts it); "Request cancellation" cancels it.',
      'Once cancelled, "Check / refund customer" refunds them if they were never refunded, or tells you what was already refunded.',
    ],
    links: [{ label: 'eSIM Orders', to: '/dashboard/veloxverse/esim-orders' }],
  },
  {
    id: 'bookings',
    section: 'VeloxVerse services',
    title: 'Lounge & benefits bookings',
    summary: 'Lounge, dining, fast track, fitness and memberships.',
    page: '/dashboard/veloxverse/lounge',
    keywords: ['lounge', 'dining', 'fast track', 'fitness', 'membership', 'dragonpass', 'epass', 'airport'],
    steps: [
      'Open Lounge and pick a tab: Lounge, Dining, Fast Track, Fitness, All or Memberships.',
      'Search by email, name, order no. or ePass ID, or filter by airport (e.g. LGW).',
      'Open a booking to see the customer, walk-in pass, DragonPass details, payment, pricing, cancellation, emails sent and its audit trail. A "Refund" card shows if it was refunded.',
      '"Memberships" lists each member\'s tier, visits left and expiry.',
    ],
    links: [
      { label: 'Lounge', to: '/dashboard/veloxverse/lounge' },
      { label: 'Memberships', to: '/dashboard/veloxverse/lounge?tab=memberships' },
    ],
  },
  {
    id: 'assist',
    section: 'VeloxVerse services',
    title: 'VeloxAssist: Pick & Drop and Meet & Greet',
    summary: 'Airport transfers — view, link or cancel a booking.',
    page: '/dashboard/veloxverse/transfers',
    keywords: ['assist', 'transfer', 'pick and drop', 'ride', 'driver', 'viatovia', 'meet and greet', 'cancel'],
    steps: [
      'Open Assist and pick "Pick & Drop" (rides booked through ViaTovia) or "Meet & Greet" (airport greeter requests).',
      'Search by order / reservation no, place or customer, or filter by status. Choose "View more" for route, trip, vehicle, driver, payment, emails and audit trail.',
      'If a booking has no ViaTovia reservation yet, use "Link reservation" and enter the "ViaTovia reservation number".',
      '"Cancel booking" asks for a "Cancellation reason". If ViaTovia has no ride for it, use "No ride at ViaTovia — cancel & refund" after checking their panel.',
    ],
    links: [{ label: 'Assist', to: '/dashboard/veloxverse/transfers' }],
  },
  {
    id: 'pickdrop-inbox',
    section: 'VeloxVerse services',
    title: 'Pick & Drop Emails',
    summary: 'Turn ViaTovia emails into customer emails.',
    page: '/dashboard/veloxverse/pickdrop/emails',
    keywords: ['email', 'viatovia', 'draft', 'send', 'unmatched', 'inbox'],
    steps: [
      'Open Pick & Drop Emails. "To review" lists drafts waiting for you; "Check inbox now" fetches new ViaTovia emails. The red number in the menu is what needs action.',
      'Open a draft and compare "ViaTovia said" with "Details check" and the "Customer email". "Refresh from ViaTovia" reloads the details.',
      'Choose "Send email" (or Ctrl/Cmd + Enter), or "Discard" if it shouldn\'t go out.',
      'Use "Unmatched" for emails we couldn\'t link to an order, "Sent & history" for what already went out, and "ViaTovia inbox" for every email received.',
    ],
    links: [
      { label: 'To review', to: '/dashboard/veloxverse/pickdrop/emails' },
      { label: 'ViaTovia inbox', to: '/dashboard/veloxverse/pickdrop/emails/inbox' },
    ],
  },
  {
    id: 'email-templates',
    section: 'VeloxVerse services',
    title: 'Email templates',
    summary: 'The wording Pick & Drop emails start from.',
    page: '/dashboard/veloxverse/settings/email-templates',
    keywords: ['template', 'wording', 'version', 'restore', 'preview'],
    steps: [
      'Open Email templates and choose "Edit" on a template. The switch turns a template on or off.',
      'Change the Subject and Message. "Preview with booking" shows it with a real order number (empty = sample values).',
      'Save it — every save is a new version. New drafts use it; drafts already made keep their text.',
      'In "Versions", pick an old version and choose "Restore" to go back.',
    ],
    links: [{ label: 'Email templates', to: '/dashboard/veloxverse/settings/email-templates' }],
  },

  // ── VeloxVerse customers ─────────────────────────────────────────
  {
    id: 'app-users',
    section: 'VeloxVerse customers',
    title: 'App Users (VeloxVerse accounts and guests)',
    summary: 'Spending, bookings, block, role and country.',
    page: '/dashboard/veloxverse/users',
    keywords: ['app user', 'veloxverse user', 'guest', 'block', 'unblock', 'country', 'residency', 'role'],
    steps: [
      'Open App Users and search by name or email. Filter by status: Active, Blocked or Inactive. (These are the same VeloxVerse accounts you may see in Customers — this is where you manage them.)',
      'Open a user for Total spent, Total refunded, Net spend and Points balance, plus tabs for Timeline, eSIM, Lounge & benefits, Pick & Drop, VeloxClub, Payments, Support, Forms and Activity log.',
      'To correct where they live, choose "Change" next to "Country (current residency)", pick the country, add a reason and save. This works for guests too.',
      '"Block" stops someone using the app ("Unblock" lets them back in). The Role dropdown changes their role. You can\'t change your own account here.',
    ],
    links: [{ label: 'App Users', to: '/dashboard/veloxverse/users' }],
  },
  {
    id: 'support-tickets',
    section: 'VeloxVerse customers',
    title: 'Support tickets',
    summary: 'Find a case, reply and resolve.',
    page: '/dashboard/veloxverse/support',
    keywords: ['ticket', 'case', 'support', 'reply', 'resolve'],
    steps: [
      'Open Support. If you have a case ID, enter it in "Search by Case ID" and choose "Search".',
      'Otherwise filter by status, priority or category, or search by subject, case ID or customer. Choose "View" on a ticket.',
      'Write in "Reply to customer" and choose "Send reply", or "Reply & Resolve" to close it in one go. "Mark Resolved" closes it without a reply.',
      'Change the "Status" dropdown to move it along; the "Audit trail" shows what happened.',
    ],
    links: [{ label: 'Support Tickets', to: '/dashboard/veloxverse/support' }],
  },

  // ── Rewards ──────────────────────────────────────────────────────
  {
    id: 'promo-codes',
    section: 'Rewards',
    title: 'Promo codes',
    summary: 'Create discount codes and see how they are used.',
    page: '/dashboard/veloxverse/promo-codes',
    keywords: ['promo', 'discount', 'coupon', 'code'],
    steps: [
      'Open Promo Codes and choose "New code". Fill in the details and choose "Create".',
      'Open a code ("View details") for its configuration, stats (Total uses, Unique customers, Refunded) and usage by service.',
      '"Edit" changes it — changes apply to checkouts from now on.',
      '"Usage history" lists every order that used it; filter and choose "Export CSV".',
    ],
    links: [{ label: 'Promo Codes', to: '/dashboard/veloxverse/promo-codes' }],
  },
  {
    id: 'points',
    section: 'Rewards',
    title: 'Points',
    summary: 'How customers earn and redeem points.',
    page: '/dashboard/veloxverse/points',
    keywords: ['points', 'earn', 'redeem', 'loyalty', 'redemption'],
    steps: [
      'Open Points. "Earning Rules" sets points per service — "Add service" adds one, "Set redemption rates" sets what points are worth.',
      '"Global Settings": make your changes, choose "Review Changes", then "Save Changes".',
      '"User Points" shows customers\' balances; "Change Log" shows who changed what.',
    ],
    links: [{ label: 'Points', to: '/dashboard/veloxverse/points' }],
  },
  {
    id: 'refer-earn',
    section: 'Rewards',
    title: 'Refer & Earn',
    summary: 'Referrals, top referrers and referral codes.',
    page: '/dashboard/veloxverse/refer-earn',
    keywords: ['referral', 'refer', 'invite', 'code'],
    steps: [
      'Open Refer & Earn. "Top referrers" ranks customers by referrals.',
      '"Referrals" lists each one — search by name, email or code, and use "Export CSV" for a report.',
      'Open a referral for the referrer, the referred customer, the timeline and qualifying bookings. "Manage code" changes the referral code.',
    ],
    links: [{ label: 'Refer & Earn', to: '/dashboard/veloxverse/refer-earn' }],
  },
  {
    id: 'club',
    section: 'Rewards',
    title: 'VeloxClub',
    summary: 'Membership prices, members and Club promo codes.',
    page: '/dashboard/veloxverse/club',
    keywords: ['club', 'membership', 'tier', 'member', 'cancel membership'],
    steps: [
      'Open Club. "Prices by country" sets what membership costs in each country.',
      '"Members": search by name or email, filter by tier or status, open "Member Detail". "Force Cancel" ends a membership.',
      '"Promo Codes": "Create Promo" makes a Club-only code.',
      '"Analytics" and "Change Log" show performance and history.',
    ],
    links: [{ label: 'Club', to: '/dashboard/veloxverse/club' }],
  },

  // ── Business ─────────────────────────────────────────────────────
  {
    id: 'analytics',
    section: 'Business',
    title: 'Analytics',
    summary: 'Revenue, growth and customer spending.',
    page: '/dashboard/veloxverse/analytics',
    keywords: ['analytics', 'revenue', 'growth', 'signups', 'spending', 'report'],
    steps: [
      'Open Analytics and pick a "Period:". "Show estimates in" switches the currency.',
      'The top cards cover orders and bookings, active users and eSIMs, and bookings per service.',
      '"New signups", "Order & booking status" and "Top eSIM packages" show trends.',
      '"Customer spending (top 20)": click a row to open that customer.',
    ],
    links: [{ label: 'Analytics', to: '/dashboard/veloxverse/analytics' }],
  },
  {
    id: 'pricing',
    section: 'Business',
    title: 'Pricing rules',
    summary: 'The prices customers see.',
    page: '/dashboard/veloxverse/pricing',
    keywords: ['pricing', 'price', 'rule', 'markup', 'draft', 'publish'],
    steps: [
      'Open Pricing. Filter by status: Published, Draft or Archived.',
      'A new rule is created as a Draft — nothing changes for customers until you publish it.',
      'Rules can be published, duplicated or archived from the list; "Rule history" shows earlier versions.',
    ],
    links: [{ label: 'Pricing', to: '/dashboard/veloxverse/pricing' }],
  },
  {
    id: 'payments',
    section: 'Business',
    title: 'Payments',
    summary: 'Every payment, its details and a CSV report.',
    page: '/dashboard/veloxverse/payments',
    keywords: ['payment', 'charge', 'card', 'mint', 'stripe', 'invoice', 'report', 'export'],
    steps: [
      'Open Payments and search by order, customer, transaction ref, invoice or promo.',
      'Filter by outcome, service, card provider (Mint / Stripe) or "Refunded".',
      'Click a row for "Payment details": amounts (card, wallet credit, points, VeloxClub discount), refunds and card attempts.',
      'For a report, set your filters and choose "Export CSV".',
    ],
    links: [{ label: 'Payments', to: '/dashboard/veloxverse/payments' }],
  },
  {
    id: 'refunds',
    section: 'Business',
    title: 'Refunds',
    summary: 'Track every refund and spot stuck ones.',
    page: '/dashboard/veloxverse/refunds',
    keywords: ['refund', 'failed', 'stuck', 'pending'],
    steps: [
      'Open Refunds and search by order, customer or refund ref. Filter by status, service or who started it.',
      'Use "Failed" and "Stuck" (pending over 24h) to see the refunds that need attention.',
      'Click a row to open the payment it belongs to.',
      'Refunds themselves are started from the booking (e.g. an eSIM\'s "Check / refund customer", or cancelling an Assist booking).',
    ],
    links: [{ label: 'Refunds', to: '/dashboard/veloxverse/refunds' }],
  },
  {
    id: 'reconciliation',
    section: 'Business',
    title: 'Supplier reconciliation',
    summary: 'Compare our bookings with the supplier\'s.',
    page: '/dashboard/veloxverse/reconciliation',
    keywords: ['reconciliation', 'supplier', 'mismatch', 'margin', 'cost'],
    steps: [
      'Open Reconciliation. The cards count Bookings, Mismatch, Missing there and Missing here.',
      'Filter by result or search by order, ref, payment or email.',
      'Each row shows our status vs theirs, what we received, the supplier cost and the margin.',
      '"Export CSV" downloads it for finance.',
    ],
    links: [{ label: 'Reconciliation', to: '/dashboard/veloxverse/reconciliation' }],
  },
  {
    id: 'country-rules',
    section: 'Business',
    title: 'Country Availability',
    summary: 'Which services each country can use.',
    page: '/dashboard/veloxverse/country-availability',
    keywords: ['country', 'availability', 'rules', 'region'],
    steps: [
      'Open Country Availability. The "Services" tab shows each service and where it is offered.',
      'A customer gets a service if it is allowed where they live ("Country (current residency)") or where they are right now.',
      'Use "Preview a country" to see what a customer in that country gets.',
      '"Change history" shows who changed what, and when.',
    ],
    links: [{ label: 'Country Availability', to: '/dashboard/veloxverse/country-availability' }],
  },

  // ── Monitoring ───────────────────────────────────────────────────
  {
    id: 'system-health',
    section: 'Monitoring',
    title: 'System health',
    summary: 'Is VeloxVerse and every supplier working right now?',
    page: '/dashboard/veloxverse/system-health',
    keywords: ['health', 'status', 'down', 'outage', 'jobs', 'supplier'],
    steps: [
      'Open System health. The banner says "Everything is working." or what is having problems.',
      'Each row shows calls, failures, speed and "Last OK". Grey means "not used recently", not a fault.',
      'It refreshes every minute; "Check now" checks immediately. Admins get an email if VeloxVerse stops answering.',
    ],
    links: [{ label: 'System health', to: '/dashboard/veloxverse/system-health' }],
  },

  // ── Audit ────────────────────────────────────────────────────────
  {
    id: 'audit-logs',
    section: 'Audit',
    title: 'Audit Logs: what happened to a customer',
    summary: 'Start here for any complaint.',
    page: '/dashboard/veloxverse/audit-logs',
    keywords: ['audit', 'journey', 'event', 'support reference', 'complaint', 'investigate'],
    steps: [
      'Open Audit Logs and search by support reference, customer email, journey / payment / event id or order no. Choose "Find".',
      'Pick a time range ("Last hour" to "Everything kept") and use "Filters" for service, severity, step, status or supplier.',
      'Click an event for its details and "What to do". "Request (support ref)" opens the full request trace; the customer link opens their activity.',
      '"Refunds needing attention" shows failed or wrong-amount refunds to check in the Mint portal.',
      'Support staff: customer email, name, IP and browser are masked for you.',
    ],
    links: [{ label: 'Audit Logs', to: '/dashboard/veloxverse/audit-logs' }],
  },
  {
    id: 'audit-trails',
    section: 'Audit',
    title: 'Follow a request, journey or booking',
    summary: 'Trace, journey and booking trail pages.',
    page: '/dashboard/veloxverse/audit-logs',
    keywords: ['trace', 'journey', 'booking trail', 'timeline', 'guest activity'],
    steps: [
      'Request trace: customer → journey → request → supplier calls → errors, then every event of that request.',
      'Journey: one booking attempt end to end — outcome, payments and a timeline.',
      'Booking trail: every event for one booking or payment ("Booking trail" from Stuck customers or an event).',
      'Customer / Guest activity: everything one customer did; "Guest activity" covers browsing before logging in.',
    ],
    links: [{ label: 'Audit Logs', to: '/dashboard/veloxverse/audit-logs' }],
  },
  {
    id: 'api-logs',
    section: 'Audit',
    title: 'API Logs and API timeline',
    summary: 'Did a supplier or payment call happen, and what came back?',
    page: '/dashboard/veloxverse/audit-logs/api',
    keywords: ['api', 'request', 'webhook', 'supplier call', 'dragonpass', 'mint', 'timeline', 'slow'],
    steps: [
      'Open the "API Logs" tab and search by booking no., payment id, DragonPass order, Mint ref or request id.',
      'Quick filters: "Errors only", "Money calls", "Slow (> 5 s)". "Needs attention" shows calls with an unknown outcome or no answer.',
      'Click a call for the request and response, retries and its timeline. "More actions" → "Copy link" / "Open timeline" / "Open journey".',
      'API timeline ("Show timeline") lists every call behind one booking or payment, oldest first.',
    ],
    links: [
      { label: 'API Logs', to: '/dashboard/veloxverse/audit-logs/api' },
      { label: 'API timeline', to: '/dashboard/veloxverse/audit-logs/api/timeline' },
    ],
  },
  {
    id: 'api-health',
    section: 'Audit',
    title: 'API Health',
    summary: 'Is our API or a supplier slow or failing?',
    page: '/dashboard/veloxverse/audit-logs/api-health',
    keywords: ['api health', 'latency', 'error rate', 'supplier', 'webhook'],
    steps: [
      'Open the "API Health" tab and pick a range (1 h to 7 days).',
      'Choose a direction: "Inbound (customer / CRM)", "Supplier calls" or "Webhooks" to see how each is doing.',
    ],
    links: [{ label: 'API Health', to: '/dashboard/veloxverse/audit-logs/api-health' }],
  },
  {
    id: 'stuck',
    section: 'Audit',
    title: 'Stuck customers',
    summary: 'People stuck right now — e.g. paid but not booked.',
    page: '/dashboard/veloxverse/audit-logs/stuck',
    keywords: ['stuck', 'paid not booked', 'problem'],
    steps: [
      'Open the "Stuck customers" tab. It refreshes every minute ("Refresh" to update now).',
      'Use the rule chips to narrow by problem.',
      'On a row, choose "Open journey", "Booking trail" or "Customer" to investigate — ideally before they contact you.',
    ],
    links: [{ label: 'Stuck customers', to: '/dashboard/veloxverse/audit-logs/stuck' }],
  },
  {
    id: 'errors-trends',
    section: 'Audit',
    title: 'Errors and Daily trends',
    summary: 'What is going wrong, and how things change day by day.',
    page: '/dashboard/veloxverse/audit-logs/errors',
    keywords: ['errors', 'trends', 'daily', 'downtime', 'charts'],
    steps: [
      '"Errors": pick 1 hour, 24 hours or 7 days. See errors by severity, service, supplier and HTTP status, plus "Top errors".',
      '"Daily trends": one row per UTC day — events, journeys started vs completed, errors, paid but not booked, downtime and supplier speed.',
      'Click a day for its top errors, failing routes and payment problems.',
    ],
    links: [
      { label: 'Errors', to: '/dashboard/veloxverse/audit-logs/errors' },
      { label: 'Daily trends', to: '/dashboard/veloxverse/audit-logs/trends' },
    ],
  },
  {
    id: 'alerts',
    section: 'Audit',
    title: 'Alerts',
    summary: 'Problems VeloxVerse detected and emailed about.',
    page: '/dashboard/veloxverse/audit-logs/alerts',
    keywords: ['alert', 'email', 'digest', 'incident'],
    steps: [
      'Open the "Alerts" tab. "Open" shows current problems; "Resolved", "All" and "Digests" show the rest.',
      'Each alert shows when it was first and last seen, how often, and who was emailed. Click one to see the events behind it.',
    ],
    links: [{ label: 'Alerts', to: '/dashboard/veloxverse/audit-logs/alerts' }],
  },
  {
    id: 'audit-settings',
    section: 'Audit',
    title: 'Audit log settings and alert emails',
    summary: 'Retention, API logging and who gets alerts.',
    page: '/dashboard/veloxverse/audit-logs/settings',
    keywords: ['retention', 'alert recipient', 'settings', 'threshold'],
    steps: [
      'Open the "Settings" tab. "Retention" sets how many days logs are kept; "API logs" turns recording on or off.',
      '"Alert emails" sets when an alert fires (spikes, error rate, failed payments…). Choose "Save settings".',
      '"Alert recipients": "Add recipient", pick alert types and minimum severity, and use "Send test email" to check it arrives.',
    ],
    links: [{ label: 'Audit log settings', to: '/dashboard/veloxverse/audit-logs/settings' }],
  },

  // ── Your account ─────────────────────────────────────────────────
  {
    id: 'verification',
    section: 'Your account',
    title: 'Verify your account',
    summary: 'Upload your documents and track them.',
    page: '/dashboard/verification',
    keywords: ['verification', 'documents', 'upload', 'kyc'],
    steps: [
      'Open Verification. "Required Documents" lists what you need to send.',
      'Choose "Upload Document" for each one; "Document Status" and "Activity Timeline" show where each stands.',
      'Until you are verified, this is the only page you can use.',
    ],
    links: [{ label: 'Verification', to: '/dashboard/verification' }],
  },
  {
    id: 'my-profile',
    section: 'Your account',
    title: 'My Profile',
    summary: 'Your own dashboard.',
    page: '/dashboard/me',
    keywords: ['profile', 'my dashboard', 'tasks'],
    steps: [
      '"My Dashboard" gives you a "Quick Overview" of your work.',
      '"My Tasks", "My Leads" and "Activity Log" are coming soon.',
    ],
    links: [{ label: 'My Profile', to: '/dashboard/me' }],
  },
]

/** Does `topic` match the guide search (title, summary, section, steps or keywords)? */
export function matchesGuideSearch(topic: GuideTopic, search: string): boolean {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = [topic.title, topic.summary, topic.section, ...topic.steps, ...(topic.keywords ?? [])].join(' ').toLowerCase()
  return words.every((word) => text.includes(word))
}

/** The topics `role` may see, each with only the links it can open. */
export function guideTopicsForRole(role: UserRole | null | undefined): GuideTopic[] {
  if (!role) return []
  return GUIDE_TOPICS.filter((topic) => !topic.page || canAccess(role, topic.page)).map((topic) => ({
    ...topic,
    links: topic.links.filter((link) => canAccess(role, link.to)),
  }))
}

/** Shareable link to a topic: its own page with ?guide=<id> (a topic without a page: the current page). */
export function topicShareUrl(topic: GuideTopic, location: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  const url = new URL(topic.page ?? location.pathname, location.origin)
  url.searchParams.set('guide', topic.id)
  return url.toString()
}
