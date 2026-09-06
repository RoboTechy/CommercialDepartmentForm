const config = require('./config');
const { sections, findSection } = require('./sections');

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function isAdmin(user) {
  return user.groups.includes(config.ldap.groups.admin);
}

function canEditSection(user, sectionKey) {
  const section = findSection(sectionKey);
  if (!section) return false;
  if (isAdmin(user)) return true;
  return user.groups.includes(section.group);
}

function canCreateRows(user) {
  if (isAdmin(user)) return true;
  return sections.some((s) => s.canCreateRows && user.groups.includes(s.group));
}

module.exports = { requireLogin, isAdmin, canEditSection, canCreateRows };
