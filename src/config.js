require('dotenv').config();

function need(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value;
}

module.exports = {
  port: parseInt(need('PORT', '3000'), 10),
  sessionSecret: need('SESSION_SECRET', 'dev-secret-change-me'),
  dataFile: need('DATA_FILE', require('path').join(__dirname, '..', 'data', 'forms.json')),
  ldap: {
    url: need('LDAP_URL', 'ldap://localhost:1389'),
    bindDN: need('LDAP_BIND_DN', ''),
    bindPassword: need('LDAP_BIND_PASSWORD', ''),
    userBase: need('LDAP_USER_BASE', ''),
    groupBase: need('LDAP_GROUP_BASE', ''),
    usernameAttribute: need('LDAP_USERNAME_ATTRIBUTE', 'uid'),
    groups: {
      technical: need('LDAP_GROUP_TECHNICAL', 'technical'),
      operator: need('LDAP_GROUP_OPERATOR', 'operator'),
      warehouse: need('LDAP_GROUP_WAREHOUSE', 'warehouse'),
      commercial: need('LDAP_GROUP_COMMERCIAL', 'commercial'),
      admin: need('LDAP_GROUP_ADMIN', 'formadmin'),
    },
  },
};
