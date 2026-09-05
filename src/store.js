const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { sections } = require('./sections');

let writeChain = Promise.resolve();

function ensureDataFile() {
  const dir = path.dirname(config.dataFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(config.dataFile)) {
    fs.writeFileSync(config.dataFile, JSON.stringify({ forms: [] }, null, 2));
  }
}

function readAll() {
  ensureDataFile();
  const raw = fs.readFileSync(config.dataFile, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { forms: [] };
  }
}

// نوشتن فایل را صف‌بندی می‌کند تا از رقابت (race condition) بین درخواست‌های همزمان جلوگیری شود
function writeAll(data) {
  writeChain = writeChain.then(
    () =>
      new Promise((resolve, reject) => {
        fs.writeFile(config.dataFile, JSON.stringify(data, null, 2), (err) => (err ? reject(err) : resolve()));
      })
  );
  return writeChain;
}

function listForms() {
  return readAll().forms.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function getForm(id) {
  return readAll().forms.find((f) => f.id === id);
}

async function createForm({ title, requesterName, createdBy }) {
  const data = readAll();
  const form = {
    id: crypto.randomUUID(),
    title,
    requesterName,
    createdBy,
    createdAt: new Date().toISOString(),
    sections: {},
  };
  for (const section of sections) {
    form.sections[section.key] = {
      status: 'در انتظار تکمیل',
      values: {},
      updatedBy: null,
      updatedAt: null,
    };
  }
  data.forms.push(form);
  await writeAll(data);
  return form;
}

async function updateSection(formId, sectionKey, values, updatedBy) {
  const data = readAll();
  const form = data.forms.find((f) => f.id === formId);
  if (!form) throw new Error('فرم یافت نشد');
  form.sections[sectionKey] = {
    status: 'تکمیل شده',
    values,
    updatedBy,
    updatedAt: new Date().toISOString(),
  };
  await writeAll(data);
  return form;
}

module.exports = { listForms, getForm, createForm, updateSection };
