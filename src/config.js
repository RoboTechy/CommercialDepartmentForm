require('dotenv').config();

function need(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value;
}

module.exports = {
  port: parseInt(need('PORT', '3000'), 10),
  sessionSecret: need('SESSION_SECRET', 'dev-secret-change-me'),
  dbFile: need('DB_FILE', require('path').join(__dirname, '..', 'data', 'app.db')),
  // حساب ادمین محلی (اختیاری) - کاملاً مستقل از LDAP/Active Directory، برای
  // مواقعی که اتصال به دامنه قطع می‌شود. اگر LOCAL_ADMIN_USERNAME خالی باشد،
  // این قابلیت کاملاً غیرفعال است.
  localAdmin: {
    username: need('LOCAL_ADMIN_USERNAME', ''),
    password: need('LOCAL_ADMIN_PASSWORD', ''),
  },
  ldap: {
    url: need('LDAP_URL', 'ldap://localhost:1389'),
    bindDN: need('LDAP_BIND_DN', ''),
    bindPassword: need('LDAP_BIND_PASSWORD', ''),
    userBase: need('LDAP_USER_BASE', ''),
    groupBase: need('LDAP_GROUP_BASE', ''),
    usernameAttribute: need('LDAP_USERNAME_ATTRIBUTE', 'uid'),
    groups: {
      techOperator: need('LDAP_GROUP_TECH_OPERATOR', 'tech_operator'),
      warehouse: need('LDAP_GROUP_WAREHOUSE', 'warehouse'),
      commercial: need('LDAP_GROUP_COMMERCIAL', 'commercial'),
      admin: need('LDAP_GROUP_ADMIN', 'formadmin'),
    },
  },
};
