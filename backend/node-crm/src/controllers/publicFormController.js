import { getPublicForm } from "../services/formService.js";
import { processFormSubmission } from "../services/submissionService.js";
import { validateEmail } from "../services/spamService.js";
import { sendSuccess, sendError } from "../utils/response.js";

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
      form_json: form.form_json,
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

    const { data, formLoadedAt } = req.body;
    if (!data || typeof data !== "object") {
      throw { status: 400, message: "Submission data is required" };
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers["user-agent"] || null;

    const result = await processFormSubmission({
      formId,
      data,
      formLoadedAt,
      ipAddress,
      userAgent,
    });

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
  const apiBase = process.env.PUBLIC_API_BASE || `${req.protocol}://${req.get("host")}`;

  const script = `
(function(window, document) {
  'use strict';

  var CRMForm = {
    _apiBase: '${apiBase}',

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
            html += '<label style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-weight:normal;"><input type="radio" ' + name + ' value="' + CRMForm._esc(opt) + '" ' + req + '> ' + CRMForm._esc(opt) + '</label>';
          });
        } else if (field.type === 'checkbox') {
          (field.options || []).forEach(function(opt){
            html += '<label style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-weight:normal;"><input type="checkbox" name="' + CRMForm._esc(field.id) + '[]" value="' + CRMForm._esc(opt) + '"> ' + CRMForm._esc(opt) + '</label>';
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
    }
  };

  window.CRMForm = CRMForm;
})(window, document);
`.trim();

  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(script);
};
