/**
 * Seed / update script — VeloxCredit loan application forms.
 *
 * Usage (from the Velox-CRM project root):
 *   docker compose exec backend node scripts/seed-loan-forms.js
 *
 * Idempotent: creates missing forms and updates existing ones by slug.
 */
import "dotenv/config";
import pool, { query } from "../config/db.js";

const LOAN_TERMS = ["2 Years", "3 Years", "4 Years", "5 Years", "7 Years"];
const BALLOON_OPTIONS = ["0% (Most common)", "10%", "20%", "30%", "40%"];
const RESIDENTIAL_STATUS = [
  "Own home outright",
  "Own+Mortgage",
  "Renting",
  "With parents",
  "Boarding",
];
const ADDRESS_DURATION = [
  "Less than 12 months",
  "1 year",
  "2 years",
  "3 years",
  "3+ years",
];
const EMPLOYMENT_STATUS = [
  "Full time",
  "Part time",
  "Self employed",
  "Casual",
  "Centrelink",
];
const RESIDENCY_STATUS = [
  "Australian Citizen",
  "Permanent residents",
  "Working Visa",
  "Student Visa",
];
const CREDIT_SCORE = ["Excellent", "Good", "Average", "Poor", "Not sure"];

const LENDERS = [
  "ANZ", "Bankwest", "CBA", "Citigroup", "HSBC",
  "Latitude", "NAB", "St. George", "Westpac", "AMEX", "Other",
];

const LOAN_TYPES = [
  "Home Loan", "Personal Loan", "Tax Debt",
  "Car Finance", "After Pay / Zip Pay", "Other",
];

/* ─────── Shared field builders ─────── */

function creditScoreNote() {
  return {
    id: "credit_score_note",
    type: "section",
    label: "No impact on credit score",
    helpText: "Checking your options with us will not affect your credit score.",
    width: "full",
  };
}

function contactFields() {
  return [
    {
      id: "contact_intro",
      type: "section",
      label: "What's your name?",
      helpText:
        "Your information is protected and we will never sell to any marketing companies.",
      width: "full",
    },
    { id: "first_name", type: "text", label: "First Name", required: true, width: "half" },
    { id: "last_name", type: "text", label: "Last Name", required: true, width: "half" },
    { id: "email", type: "email", label: "Email Address", required: true, width: "full" },
    {
      id: "mobile",
      type: "phone",
      label: "Mobile Number",
      placeholder: "0400 000 000",
      helpText: "Australia (+61)",
      required: true,
      width: "full",
    },
  ];
}

function profileFields() {
  return [
    {
      id: "residential_status",
      type: "radio",
      label: "What's your residential status?",
      options: RESIDENTIAL_STATUS,
      required: true,
      width: "full",
    },
    {
      id: "address_duration",
      type: "radio",
      label: "How long have you been living at your current address?",
      options: ADDRESS_DURATION,
      required: true,
      width: "full",
    },
    {
      id: "employment_status",
      type: "radio",
      label: "Current employment status?",
      options: EMPLOYMENT_STATUS,
      required: true,
      width: "full",
    },
    {
      id: "residency_status",
      type: "radio",
      label: "Residency status?",
      options: RESIDENCY_STATUS,
      required: true,
      width: "full",
    },
    {
      id: "credit_score",
      type: "radio",
      label: "What would be your credit score? (Best guess)",
      options: CREDIT_SCORE,
      required: true,
      width: "full",
    },
  ];
}

function buildHomeLoanFields() {
  return {
    fields: [
      { id: "monthly_rent", type: "text", label: "How much is your monthly share of rent (put 0 if you pay mortgage) at your current address?", placeholder: "e.g. 1500", required: true, width: "full" },
      { id: "monthly_food", type: "text", label: "Your monthly spending on food, entertainment, clothing", placeholder: "e.g. 800", required: true, width: "full" },
      { id: "monthly_utilities", type: "text", label: "And monthly spending on utilities like insurance, mobile, power, etc.", placeholder: "e.g. 400", required: true, width: "full" },
      { id: "has_credit_card", type: "radio", label: "Do you have a credit card?", options: ["Yes", "No"], required: true, width: "full" },
      { id: "credit_card_providers", type: "checkbox", label: "Income source (select multiple if you got more than one)", options: LENDERS, required: false, width: "full" },
      { id: "combined_credit_limit", type: "text", label: "Combined Credit Limit", placeholder: "e.g. 10000", required: false, width: "half" },
      { id: "combined_amount_owing", type: "text", label: "Combined Amount Owing", placeholder: "e.g. 3000", required: false, width: "half" },
      { id: "has_other_loans", type: "radio", label: "Almost there, do you have any other loan? e.g. Mortgage, Personal loan, Tax Debt", options: ["Yes", "No"], required: true, width: "full" },
      { id: "loan_types", type: "checkbox", label: "Type of loan", options: LOAN_TYPES, required: false, width: "full" },
      { id: "hl_lender", type: "dropdown", label: "Home Loan — Lender", options: LENDERS, required: false, width: "full" },
      { id: "hl_amount_owing", type: "text", label: "Home Loan — Amount owing", placeholder: "e.g. 350000", required: false, width: "half" },
      { id: "hl_monthly_repayment", type: "text", label: "Home Loan — Monthly repayment", placeholder: "e.g. 2200", required: false, width: "half" },
      { id: "pl_lender", type: "dropdown", label: "Personal Loan — Lender", options: LENDERS, required: false, width: "full" },
      { id: "pl_amount_owing", type: "text", label: "Personal Loan — Amount owing", placeholder: "e.g. 15000", required: false, width: "half" },
      { id: "pl_monthly_repayment", type: "text", label: "Personal Loan — Monthly repayment", placeholder: "e.g. 500", required: false, width: "half" },
      { id: "td_amount_owing", type: "text", label: "Tax Debt — Amount owing", placeholder: "e.g. 5000", required: false, width: "half" },
      { id: "td_monthly_repayment", type: "text", label: "Tax Debt — Monthly repayment", placeholder: "e.g. 200", required: false, width: "half" },
      { id: "cf_lender", type: "dropdown", label: "Car Finance — Lender", options: LENDERS, required: false, width: "full" },
      { id: "cf_amount_owing", type: "text", label: "Car Finance — Amount owing", placeholder: "e.g. 25000", required: false, width: "half" },
      { id: "cf_monthly_repayment", type: "text", label: "Car Finance — Monthly repayment", placeholder: "e.g. 600", required: false, width: "half" },
      { id: "ap_amount_owing", type: "text", label: "After Pay / Zip Pay — Amount owing", placeholder: "e.g. 1000", required: false, width: "half" },
      { id: "ap_monthly_repayment", type: "text", label: "After Pay / Zip Pay — Monthly repayment", placeholder: "e.g. 200", required: false, width: "half" },
      { id: "other_loan_kind", type: "text", label: "Other — What kind of loan?", placeholder: "e.g. HECS-HELP", required: false, width: "full" },
      { id: "other_amount_owing", type: "text", label: "Other — Amount owing", placeholder: "e.g. 8000", required: false, width: "half" },
      { id: "other_monthly_repayment", type: "text", label: "Other — Monthly repayment", placeholder: "e.g. 150", required: false, width: "half" },
    ],
    steps: [
      { id: "expenses", title: "Your Expenses", fieldIds: ["monthly_rent", "monthly_food", "monthly_utilities"] },
      { id: "credit_card", title: "Credit Card Details", fieldIds: ["has_credit_card", "credit_card_providers", "combined_credit_limit", "combined_amount_owing"] },
      {
        id: "other_loans",
        title: "Other Loans",
        fieldIds: [
          "has_other_loans", "loan_types",
          "hl_lender", "hl_amount_owing", "hl_monthly_repayment",
          "pl_lender", "pl_amount_owing", "pl_monthly_repayment",
          "td_amount_owing", "td_monthly_repayment",
          "cf_lender", "cf_amount_owing", "cf_monthly_repayment",
          "ap_amount_owing", "ap_monthly_repayment",
          "other_loan_kind", "other_amount_owing", "other_monthly_repayment",
        ],
      },
    ],
  };
}

function buildCarLoanFields() {
  return {
    fields: [
      {
        id: "purpose_intro",
        type: "section",
        label: "Let's get to know the purpose first",
        width: "full",
      },
      {
        id: "loan_purpose",
        type: "radio",
        label: "What are you looking to do?",
        options: ["Buy a car", "Refinance your car"],
        required: true,
        width: "full",
      },
      {
        id: "buy_amount",
        type: "text",
        label: "How much do you need to buy the car?",
        placeholder: "e.g. 35000",
        helpText: "Complete if you selected Buy a car",
        required: false,
        width: "full",
      },
      {
        id: "refinance_amount",
        type: "text",
        label: "How much roughly do you owe?",
        placeholder: "e.g. 28000",
        helpText: "Complete if you selected Refinance your car",
        required: false,
        width: "full",
      },
      creditScoreNote(),
      {
        id: "loan_term",
        type: "radio",
        label: "And what loan term suits you?",
        options: LOAN_TERMS,
        required: true,
        width: "full",
      },
      {
        id: "balloon_payment",
        type: "radio",
        label: "Any end of loan payment? (Balloon or residual payment)",
        options: BALLOON_OPTIONS,
        required: true,
        width: "full",
      },
      ...profileFields(),
      {
        id: "estimate",
        type: "section",
        label: "Good News! We can help",
        helpText:
          "Annual interest rate: 9.99% to 10.99%\n" +
          "Monthly Repayment: $148.26 to $150.01\n" +
          "Fortnightly Repayment: $74.13 to $75.00\n" +
          "Weekly Repayment: $37.06 to $37.50\n" +
          "Balloon: $350.00\n\n" +
          "Our team would try to get better than this but we need more information.",
        width: "full",
      },
      ...contactFields(),
    ],
    steps: [
      {
        id: "purpose",
        title: "Purpose",
        fieldIds: ["purpose_intro", "loan_purpose", "buy_amount", "refinance_amount", "credit_score_note"],
      },
      {
        id: "loan_details",
        title: "Loan Details",
        fieldIds: ["loan_term", "balloon_payment"],
      },
      {
        id: "about_you",
        title: "About You",
        fieldIds: [
          "residential_status",
          "address_duration",
          "employment_status",
          "residency_status",
          "credit_score",
        ],
      },
      {
        id: "estimate",
        title: "Your Estimate",
        fieldIds: ["estimate"],
      },
      {
        id: "contact",
        title: "Contact Details",
        fieldIds: ["contact_intro", "first_name", "last_name", "email", "mobile"],
      },
    ],
  };
}

function buildPersonalLoanFields() {
  return {
    fields: [
      {
        id: "purpose_intro",
        type: "section",
        label: "Let's get to know the purpose first",
        width: "full",
      },
      {
        id: "loan_purpose",
        type: "radio",
        label: "What are you looking to do?",
        options: ["New personal loan", "Refinance an existing loan"],
        required: true,
        width: "full",
      },
      {
        id: "new_loan_amount",
        type: "text",
        label: "How much are you looking to borrow?",
        placeholder: "e.g. 15000",
        helpText: "Complete if you selected New personal loan",
        required: false,
        width: "full",
      },
      {
        id: "refinance_amount",
        type: "text",
        label: "How much do you need all together?",
        placeholder: "e.g. 20000",
        helpText: "Complete if you selected Refinance an existing loan",
        required: false,
        width: "full",
      },
      creditScoreNote(),
      {
        id: "loan_term",
        type: "radio",
        label: "And what loan term suits you?",
        options: LOAN_TERMS,
        required: true,
        width: "full",
      },
      ...profileFields(),
      {
        id: "estimate",
        type: "section",
        label: "Good News! We can help",
        helpText:
          "Annual interest rate: 7.50% to 9.95%\n" +
          "Monthly Repayment: $135.00 to $138.37\n" +
          "Fortnightly Repayment: $67.50 to $69.18\n" +
          "Weekly Repayment: $33.75 to $34.59\n\n" +
          "Our team would try to get better than this but we need more information.",
        width: "full",
      },
      ...contactFields(),
    ],
    steps: [
      {
        id: "purpose",
        title: "Purpose",
        fieldIds: ["purpose_intro", "loan_purpose", "new_loan_amount", "refinance_amount", "credit_score_note"],
      },
      {
        id: "loan_details",
        title: "Loan Details",
        fieldIds: ["loan_term"],
      },
      {
        id: "about_you",
        title: "About You",
        fieldIds: [
          "residential_status",
          "address_duration",
          "employment_status",
          "residency_status",
          "credit_score",
        ],
      },
      {
        id: "estimate",
        title: "Your Estimate",
        fieldIds: ["estimate"],
      },
      {
        id: "contact",
        title: "Contact Details",
        fieldIds: ["contact_intro", "first_name", "last_name", "email", "mobile"],
      },
    ],
  };
}

function buildBusinessLoanFields() {
  return {
    fields: [
      {
        id: "borrow_amount",
        type: "text",
        label: "How much are you looking to borrow?",
        placeholder: "e.g. 50000",
        required: true,
        width: "full",
      },
      creditScoreNote(),
      {
        id: "owns_property",
        type: "radio",
        label: "Do you own any property?",
        options: ["Yes", "No"],
        required: true,
        width: "full",
      },
      {
        id: "property_address",
        type: "text",
        label: "Address of your property",
        placeholder: "Street, suburb, state, postcode",
        helpText: "Complete if you own property",
        required: false,
        width: "full",
      },
      ...contactFields(),
    ],
    steps: [
      {
        id: "loan_amount",
        title: "Loan Amount",
        fieldIds: ["borrow_amount", "credit_score_note"],
      },
      {
        id: "property",
        title: "Property",
        fieldIds: ["owns_property", "property_address"],
      },
      {
        id: "contact",
        title: "Contact Details",
        fieldIds: ["contact_intro", "first_name", "last_name", "email", "mobile"],
      },
    ],
  };
}

const FORMS = [
  {
    name: "Home Loan Application",
    slug: "home-loan",
    description: "Apply for a home loan through VeloxCredit. We'll assess your expenses, existing credit, and other liabilities.",
    form_json: buildHomeLoanFields(),
    submit_button_label: "Submit Application",
    success_message: "Thank you! Your home loan application has been received. Our team will review it and get back to you shortly.",
    status: "published",
    notify_on_submission: true,
    notify_emails: ["info@pharmbotai.com"],
  },
  {
    name: "Car Loan Application",
    slug: "car-loan",
    description: "Apply for a car loan through VeloxCredit — buy a new car or refinance your existing finance.",
    form_json: buildCarLoanFields(),
    submit_button_label: "Request a callback",
    success_message: "Thank you! Your car loan enquiry has been received. Our team will call you back shortly.",
    status: "published",
    notify_on_submission: true,
    notify_emails: ["info@pharmbotai.com"],
  },
  {
    name: "Personal Loan Application",
    slug: "personal-loan",
    description: "Apply for a personal loan or refinance an existing loan through VeloxCredit.",
    form_json: buildPersonalLoanFields(),
    submit_button_label: "Request a callback",
    success_message: "Thank you! Your personal loan enquiry has been received. Our team will call you back shortly.",
    status: "published",
    notify_on_submission: true,
    notify_emails: ["info@pharmbotai.com"],
  },
  {
    name: "Business Loan Application",
    slug: "business-loan",
    description: "Apply for a business loan through VeloxCredit.",
    form_json: buildBusinessLoanFields(),
    submit_button_label: "Request a callback",
    success_message: "Thank you! Your business loan enquiry has been received. Our team will call you back shortly.",
    status: "published",
    notify_on_submission: true,
    notify_emails: ["info@pharmbotai.com"],
  },
];

async function upsertForm(f) {
  const { rows } = await query("SELECT id FROM forms WHERE slug = $1", [f.slug]);
  if (rows.length > 0) {
    await query(
      `UPDATE forms
       SET name = $1, description = $2, form_json = $3,
           submit_button_label = $4, success_message = $5,
           status = $6::form_status, notify_on_submission = $7,
           notify_emails = $8, updated_at = NOW()
       WHERE slug = $9`,
      [
        f.name, f.description, JSON.stringify(f.form_json),
        f.submit_button_label, f.success_message,
        f.status, f.notify_on_submission, f.notify_emails,
        f.slug,
      ]
    );
    console.log(`  ✓ Updated "${f.name}" (id ${rows[0].id})`);
    return;
  }

  const { rows: inserted } = await query(
    `INSERT INTO forms (name, slug, description, form_json, submit_button_label, success_message,
                        status, notify_on_submission, notify_emails)
     VALUES ($1, $2, $3, $4, $5, $6, $7::form_status, $8, $9)
     RETURNING id`,
    [
      f.name, f.slug, f.description,
      JSON.stringify(f.form_json),
      f.submit_button_label, f.success_message,
      f.status, f.notify_on_submission, f.notify_emails,
    ]
  );
  console.log(`  ✓ Created "${f.name}" (id ${inserted[0].id})`);
}

async function seed() {
  console.log("Seeding / updating VeloxCredit loan forms…");

  // Rename legacy Travel Credit form → Business Loan
  const { rowCount } = await query(
    `UPDATE forms
     SET slug = 'business-loan', name = 'Business Loan Application'
     WHERE slug = 'travel-credit'`
  );
  if (rowCount > 0) {
    console.log(`  ✓ Renamed travel-credit → business-loan`);
  }

  for (const f of FORMS) {
    await upsertForm(f);
  }

  console.log("Done.");
}

seed()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => pool.end());
