import { randomUUID } from "crypto";
import { getPublicForm } from "../services/formService.js";
import { processFormSubmission } from "../services/submissionService.js";
import { validateEmail } from "../services/spamService.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { storage, contentMatchesType } from "../storage/index.js";
import { FORM_UPLOAD_MIME_EXTENSION } from "../middleware/upload.js";
import { publicApiBase } from "../utils/publicUrls.js";
import { evaluateVvFormPass } from "../utils/vvFormPass.js";

/**
 * The part of `form_json` an anonymous visitor's browser needs to render the form. Webhook
 * rules (URLs + HMAC signing secrets) and notification rules (staff email addresses) are
 * evaluated on the server only and must never leave it.
 */
export function toPublicFormJson(formJson) {
  if (!formJson || typeof formJson !== "object") return formJson;
  // eslint-disable-next-line no-unused-vars
  const { webhookRules, notificationRules, ...publicJson } = formJson;
  return publicJson;
}

/** A value shaped like our own stored-file descriptor. Only the server may create these. */
const looksLikeFileDescriptor = (v) => !!v && typeof v === "object" && !Array.isArray(v) && v.__type === "file";

/** GET /public/forms/:id  — return published form schema */
export const handleGetPublicForm = async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    if (!Number.isFinite(formId)) throw { status: 400, message: "Invalid form ID" };

    const form = await getPublicForm(formId);

    // Only return safe fields to the public
    return sendSuccess(res, {
      id: form.id,
      name: form.name,
      description: form.description,
      form_json: toPublicFormJson(form.form_json),
      submit_button_label: form.submit_button_label,
      success_message: form.success_message,
    }, "Form fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

/** POST /public/forms/:id/submit  — accept a form submission */
export const handleSubmitForm = async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    if (!Number.isFinite(formId)) throw { status: 400, message: "Invalid form ID" };

    // VeloxVerse form pass — checked before anything is stored, so in enforce mode a form that is
    // switched off for the customer's country is refused outright (see utils/vvFormPass.js).
    const vvPass = evaluateVvFormPass(req.get("x-vv-form-pass"), formId);
    if (vvPass.refusal) {
      return res.status(403).json({ success: false, ...vvPass.refusal });
    }

    // Two shapes reach here. The React embed (PublicFormPage.tsx) always posts multipart now —
    // uploadFormSubmissionFiles (see routes/publicFormRoutes.js) parses it, and the real
    // `data`/`formLoadedAt` travel inside a single JSON `payload` field so checkbox arrays /
    // nested shapes survive exactly, with req.files holding any actual file parts alongside it.
    // The legacy plain-JS `/form.js` embed widget still posts bare `application/json` — multer
    // only acts on multipart bodies, so req.body.data/formLoadedAt land there untouched exactly
    // as before (that widget never had file fields, so nothing is lost).
    let data, formLoadedAt;
    if (typeof req.body?.payload === "string") {
      let parsed;
      try {
        parsed = JSON.parse(req.body.payload);
      } catch {
        throw { status: 400, message: "Submission data is not valid JSON" };
      }
      data = parsed?.data;
      formLoadedAt = parsed?.formLoadedAt;
    } else {
      ({ data, formLoadedAt } = req.body);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw { status: 400, message: "Submission data is required" };
    }

    // A visitor must not be able to hand us a ready-made file descriptor: staff "download"
    // reads whatever `storagePath` it names. Real uploads are attached below, from req.files.
    for (const key of Object.keys(data)) {
      if (looksLikeFileDescriptor(data[key])) delete data[key];
    }

    // Nothing is stored for a form that doesn't exist or isn't live, or for a part that isn't one
    // of its file fields — otherwise anyone could fill the bucket through any form id.
    const files = req.files ?? [];
    if (files.length > 0) {
      const form = await getPublicForm(formId);
      const fileFieldIds = new Set(
        (form.form_json?.fields ?? []).filter((f) => f?.type === "file").map((f) => String(f.id))
      );
      if (files.some((file) => !fileFieldIds.has(file.fieldname))) {
        throw { status: 400, message: "This form does not accept a file there." };
      }
    }
    for (const file of files) {
      // The browser's content type is only a label — the file's own first bytes must agree.
      if (!contentMatchesType(file.buffer, file.mimetype)) {
        throw { status: 400, message: "One of the files does not look like a valid PDF, JPG, PNG, DOC or DOCX file." };
      }
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers["user-agent"] || null;

    const storedKeys = [];
    let result;
    try {
      // Persist any uploaded files (memory-buffered by multer) through the pluggable storage
      // adapter, keyed onto `data[fieldId]` as a structured descriptor — same shape whether the
      // adapter is local disk (dev) or S3 (prod), and recognized by the admin UI's
      // SubmissionDataView to render an actual download link instead of stringifying it.
      for (const file of files) {
        const ext = FORM_UPLOAD_MIME_EXTENSION[file.mimetype] || "bin";
        const key = `form-submissions/${formId}/${randomUUID()}.${ext}`;
        const { storagePath } = await storage.put({
          key,
          buffer: file.buffer,
          contentType: file.mimetype,
        });
        storedKeys.push(storagePath);
        data[file.fieldname] = {
          __type: "file",
          originalName: file.originalname,
          storagePath,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        };
      }

      result = await processFormSubmission({
        formId,
        data,
        formLoadedAt,
        ipAddress,
        userAgent,
        vvPass: vvPass.record,
      });
    } catch (err) {
      // Storing failed partway, or the submission was refused (validation, spam rules…):
      // files already stored for it must not linger.
      await Promise.all(storedKeys.map((key) => storage.remove(key).catch(() => {})));
      throw err;
    }

    return sendSuccess(
      res,
      {
        submissionId: result.submission.id,
        leadId: result.lead.id,
        status: result.status,
        spamScore: result.spamScore,
      },
      "Submission received",
      201
    );
  } catch (err) {
    if (err.errors) {
      return sendError(res, err.message, err.status || 400, err.errors);
    }
    return sendError(res, err.message, err.status || 500);
  }
};

/**
 * GET /public/validate-email?email=xxx
 * Real-time email validation for the public form field.
 * Checks: format, disposable domain, MX records.
 * Rate-limited at the route level.
 */
export const handleValidateEmail = async (req, res) => {
  try {
    const email = req.query.email?.toString().trim() ?? "";
    const result = await validateEmail(email);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * GET /form.js  — serve the JavaScript embed helper script.
 * This small script can be included on any page; it fetches the form
 * schema from the API and renders the form into a target element.
 */
export const handleServeEmbedScript = (req, res) => {
  const { url: apiBase, configured } = publicApiBase(req);
  if (!apiBase) return sendError(res, "Invalid Host header", 400);

  const script = `
(function(window, document) {
  'use strict';

  var CRMForm = {
    // JSON-encoded (and '<' escaped): the value can never end the string literal.
    _apiBase: ${JSON.stringify(apiBase).replace(/</g, "\\u003c")},

    render: function(opts) {
      var formId = opts.formId;
      var target = typeof opts.target === 'string'
        ? document.querySelector(opts.target)
        : opts.target;

      if (!target) { console.error('[CRMForm] Target element not found:', opts.target); return; }
      if (!formId) { console.error('[CRMForm] formId is required'); return; }

      target.innerHTML = '<p style="font-family:sans-serif;color:#666;padding:16px;">Loading form...</p>';

      fetch(CRMForm._apiBase + '/public/forms/' + formId)
        .then(function(r){ return r.json(); })
        .then(function(res){
          if (!res.success) throw new Error(res.message || 'Failed to load form');
          CRMForm._renderForm(target, res.data, formId);
        })
        .catch(function(e){
          target.innerHTML = '<p style="color:red;font-family:sans-serif;padding:16px;">Could not load form: ' + e.message + '</p>';
        });
    },

    _renderForm: function(target, form, formId) {
      var loadedAt = new Date().toISOString();
      var html = '<form id="crm-embed-form-' + formId + '" style="font-family:sans-serif;max-width:600px;margin:0 auto;">';
      html += '<h2 style="margin-bottom:16px;color:#1f3864;">' + CRMForm._esc(form.name) + '</h2>';
      if (form.description) html += '<p style="color:#666;margin-bottom:20px;">' + CRMForm._esc(form.description) + '</p>';

      (form.form_json.fields || []).forEach(function(field){
        if (field.type === 'hidden') {
          html += '<input type="hidden" name="' + CRMForm._esc(field.id) + '" value="' + CRMForm._esc(field.defaultValue || '') + '">';
          return;
        }
        html += '<div style="margin-bottom:16px;">';
        html += '<label style="display:block;font-weight:600;margin-bottom:4px;color:#374151;">' + CRMForm._esc(field.label);
        if (field.required) html += ' <span style="color:red;">*</span>';
        html += '</label>';

        var inputStyle = 'width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;';
        var name = 'name="' + CRMForm._esc(field.id) + '"';
        var req = field.required ? 'required' : '';
        var ph = field.placeholder ? 'placeholder="' + CRMForm._esc(field.placeholder) + '"' : '';

        if (field.type === 'textarea') {
          html += '<textarea ' + name + ' ' + ph + ' ' + req + ' rows="4" style="' + inputStyle + 'resize:vertical;"></textarea>';
        } else if (field.type === 'dropdown') {
          html += '<select ' + name + ' ' + req + ' style="' + inputStyle + '">';
          html += '<option value="">Select...</option>';
          (field.options || []).forEach(function(opt){ html += '<option value="' + CRMForm._esc(opt) + '">' + CRMForm._esc(opt) + '</option>'; });
          html += '</select>';
        } else if (field.type === 'radio') {
          (field.options || []).forEach(function(opt){
            html += '<label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;font-weight:normal;"><input type="radio" ' + name + ' value="' + CRMForm._esc(opt) + '" ' + req + ' style="margin-top:3px;flex-shrink:0;"> ' + CRMForm._optLabel(opt) + '</label>';
          });
        } else if (field.type === 'checkbox') {
          (field.options || []).forEach(function(opt){
            html += '<label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;font-weight:normal;"><input type="checkbox" name="' + CRMForm._esc(field.id) + '[]" value="' + CRMForm._esc(opt) + '" style="margin-top:3px;flex-shrink:0;"> ' + CRMForm._optLabel(opt) + '</label>';
          });
        } else if (field.type === 'date') {
          html += '<input type="date" ' + name + ' ' + req + ' style="' + inputStyle + '">';
        } else if (field.type === 'file') {
          html += '<input type="file" ' + name + ' ' + req + ' style="' + inputStyle + '">';
        } else {
          var inputType = field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text';
          html += '<input type="' + inputType + '" ' + name + ' ' + ph + ' ' + req + ' style="' + inputStyle + '">';
        }

        if (field.helpText) html += '<p style="font-size:12px;color:#6b7280;margin-top:4px;">' + CRMForm._esc(field.helpText) + '</p>';
        html += '</div>';
      });

      html += '<button type="submit" style="background:#2e75b6;color:#fff;padding:10px 24px;border:none;border-radius:6px;font-size:15px;cursor:pointer;width:100%;">';
      html += CRMForm._esc(form.submit_button_label || 'Submit') + '</button>';
      html += '</form>';
      html += '<div id="crm-success-' + formId + '" style="display:none;text-align:center;padding:40px 20px;font-family:sans-serif;">';
      html += '<div style="font-size:48px;margin-bottom:16px;">✓</div>';
      html += '<h3 style="color:#15803d;">' + CRMForm._esc(form.success_message || 'Thank you!') + '</h3></div>';

      target.innerHTML = html;

      var formEl = document.getElementById('crm-embed-form-' + formId);
      formEl.addEventListener('submit', function(e){
        e.preventDefault();
        var fd = new FormData(formEl);
        var data = {};
        fd.forEach(function(v, k){ data[k] = v; });

        var btn = formEl.querySelector('button[type=submit]');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        fetch(CRMForm._apiBase + '/public/forms/' + formId + '/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: data, formLoadedAt: loadedAt }),
        })
          .then(function(r){ return r.json(); })
          .then(function(res){
            if (res.success) {
              formEl.style.display = 'none';
              document.getElementById('crm-success-' + formId).style.display = 'block';
            } else {
              btn.disabled = false;
              btn.textContent = form.submit_button_label || 'Submit';
              alert(res.message || 'Submission failed. Please try again.');
            }
          })
          .catch(function(){
            btn.disabled = false;
            btn.textContent = form.submit_button_label || 'Submit';
            alert('Network error. Please try again.');
          });
      });
    },

    _esc: function(str) {
      return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },
    // A radio/checkbox option's text as ONE inline run, with [label](url) rendered as links
    // (mirrors the React form's InlineLinks). Keeping it in a single span stops the label's flex
    // layout from splitting "…I accept [Terms] and [Privacy Policy]" into separate columns.
    _optLabel: function(opt) {
      var text = String(opt || ''), out = '', last = 0, m;
      var re = /\\[([^\\]]+)\\]\\(([^)]+)\\)/g;
      while ((m = re.exec(text)) !== null) {
        out += CRMForm._esc(text.slice(last, m.index));
        var url = m[2].trim();
        out += /^(https?:|mailto:|\\/)/i.test(url)
          ? '<a href="' + CRMForm._esc(url) + '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">' + CRMForm._esc(m[1]) + '</a>'
          : CRMForm._esc(m[0]);
        last = re.lastIndex;
      }
      return '<span style="flex:1;min-width:0;line-height:1.4;overflow-wrap:anywhere;">' + out + CRMForm._esc(text.slice(last)) + '</span>';
    }
  };

  window.CRMForm = CRMForm;
})(window, document);
`.trim();

  res.setHeader("Content-Type", "application/javascript");
  // Built from the Host header when PUBLIC_API_BASE is unset: then a shared cache must not keep
  // it, or a request with a forged Host would serve every embedding site a script pointing at
  // the forger's server.
  res.setHeader("Cache-Control", configured ? "public, max-age=86400" : "private, no-store");
  res.send(script);
};
