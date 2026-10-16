const db = require('./db');
const { signatureOf, shortSignature } = require('./workflow');

// ذخیره‌ی تأمین‌کنندگان، پیش‌فاکتورها و تأییدات به‌صورت سند JSON ساده در SQLite
// (حجم کم و ساختار بازبینی‌پذیر؛ فیلتر روی شناسه/ردیف با ستون جدا).

function parse(r) {
  const o = JSON.parse(r.data);
  return o;
}

// ---- تأمین‌کنندگان ----
function listVendors() {
  return db.all('SELECT * FROM vendors ORDER BY rowid DESC').map(parse);
}
function nextId(table, prefix, pad) {
  const ids = db.all(`SELECT id FROM ${table}`).map((r) => parseInt(String(r.id).replace(/\D/g, ''), 10) || 0);
  return `${prefix}-${String(Math.max(0, ...ids) + 1).padStart(pad, '0')}`;
}
function saveVendor(v) {
  db.run('INSERT OR REPLACE INTO vendors (id, data) VALUES (@id, @data)', { '@id': v.id, '@data': JSON.stringify(v) });
  return v;
}
function getVendor(id) {
  const r = db.get('SELECT * FROM vendors WHERE id = @id', { '@id': id });
  return r ? parse(r) : null;
}
function deleteVendor(id) {
  db.run('DELETE FROM vendors WHERE id = @id', { '@id': id });
}
function newVendorId() { return nextId('vendors', 'VND', 3); }

// ---- پیش‌فاکتورها ----
function listQuotations() {
  return db.all('SELECT * FROM quotations ORDER BY rowid DESC').map(parse);
}
function getQuotation(id) {
  const r = db.get('SELECT * FROM quotations WHERE id = @id', { '@id': id });
  return r ? parse(r) : null;
}
function saveQuotation(q) {
  db.run('INSERT OR REPLACE INTO quotations (id, row_id, data) VALUES (@id, @rowId, @data)', {
    '@id': q.id, '@rowId': q.rowId, '@data': JSON.stringify(q),
  });
  return q;
}
function deleteQuotation(id) {
  db.run('DELETE FROM quotations WHERE id = @id', { '@id': id });
}
function newQuotationId() { return nextId('quotations', 'QT', 4); }

// ---- تأییدات ----
function withSignature(a) {
  if (a.status !== 'approved' || !a.signatureHex) return { ...a, digitalSignatureHash: undefined, signatureValid: undefined };
  const valid = signatureOf(a) === a.signatureHex;
  return { ...a, digitalSignatureHash: shortSignature(a.signatureHex), signatureValid: valid };
}
function listApprovals() {
  return db.all('SELECT * FROM approvals ORDER BY row_id, id').map(parse).map(withSignature).map(({ signatureHex, ...rest }) => rest);
}
function listRowApprovals(rowId) {
  return db.all('SELECT * FROM approvals WHERE row_id = @r ORDER BY id', { '@r': rowId }).map(parse);
}
function getApproval(id) {
  const r = db.get('SELECT * FROM approvals WHERE id = @id', { '@id': id });
  return r ? parse(r) : null;
}
function saveApproval(a) {
  db.run('INSERT OR REPLACE INTO approvals (id, row_id, data) VALUES (@id, @rowId, @data)', {
    '@id': a.id, '@rowId': a.rowId, '@data': JSON.stringify(a),
  });
  return a;
}
function deleteRowExt(rowId) {
  db.run('DELETE FROM approvals WHERE row_id = @r', { '@r': rowId });
  db.run('DELETE FROM quotations WHERE row_id = @r', { '@r': rowId });
}

module.exports = {
  listVendors, getVendor, saveVendor, deleteVendor, newVendorId,
  listQuotations, getQuotation, saveQuotation, deleteQuotation, newQuotationId,
  listApprovals, listRowApprovals, getApproval, saveApproval, deleteRowExt,
};
