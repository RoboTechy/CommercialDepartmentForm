const express = require('express');
const router = express.Router();
const store = require('../store');
const { sections, findSection } = require('../sections');
const { requireLogin, canEditSection, isAdmin } = require('../middleware');

router.use(requireLogin);

router.get('/', (req, res) => {
  res.render('dashboard', { forms: store.listForms(), user: req.session.user });
});

router.get('/forms/new', (req, res) => {
  res.render('new-form', { user: req.session.user, error: req.flash('error') });
});

router.post('/forms', async (req, res) => {
  const { title, requesterName } = req.body;
  if (!title || !title.trim()) {
    req.flash('error', 'عنوان کالا/پروژه الزامی است');
    return res.redirect('/forms/new');
  }
  const form = await store.createForm({
    title: title.trim(),
    requesterName: (requesterName || '').trim(),
    createdBy: req.session.user.displayName || req.session.user.username,
  });
  res.redirect(`/forms/${form.id}`);
});

router.get('/forms/:id', (req, res) => {
  const form = store.getForm(req.params.id);
  if (!form) return res.status(404).render('not-found');
  const user = req.session.user;
  const sectionsView = sections.map((section) => ({
    ...section,
    data: form.sections[section.key],
    canEdit: canEditSection(user, section.key),
  }));
  res.render('form', { form, sectionsView, user, isAdmin: isAdmin(user), message: req.flash('message'), error: req.flash('error') });
});

router.post('/forms/:id/sections/:sectionKey', async (req, res) => {
  const { id, sectionKey } = req.params;
  const user = req.session.user;
  const section = findSection(sectionKey);
  const form = store.getForm(id);

  if (!form) return res.status(404).render('not-found');
  if (!section) return res.status(404).render('not-found');

  if (!canEditSection(user, sectionKey)) {
    const sectionsView = sections.map((s) => ({
      ...s,
      data: form.sections[s.key],
      canEdit: canEditSection(user, s.key),
    }));
    return res.status(403).render('form', {
      form,
      sectionsView,
      user,
      isAdmin: isAdmin(user),
      message: [],
      error: [`شما مجاز به تکمیل «${section.title}» نیستید. این بخش فقط توسط پرسنل همان بخش قابل تکمیل است.`],
    });
  }

  const values = {};
  for (const field of section.fields) {
    values[field.name] = (req.body[field.name] || '').toString().trim();
  }

  await store.updateSection(id, sectionKey, values, user.displayName || user.username);
  req.flash('message', `«${section.title}» با موفقیت ثبت شد.`);
  res.redirect(`/forms/${id}`);
});

module.exports = router;
