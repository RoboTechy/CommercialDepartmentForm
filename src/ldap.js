const ldap = require('ldapjs');
const config = require('./config');

// کاراکترهای خاص فیلتر LDAP را برای جلوگیری از تزریق فیلتر (LDAP injection) اسکیپ می‌کند
function escapeFilterValue(value) {
  return String(value).replace(/[\\*()\0]/g, (c) => {
    switch (c) {
      case '\\':
        return '\\5c';
      case '*':
        return '\\2a';
      case '(':
        return '\\28';
      case ')':
        return '\\29';
      case '\0':
        return '\\00';
      default:
        return c;
    }
  });
}

function createClient() {
  return ldap.createClient({ url: config.ldap.url, connectTimeout: 5000, timeout: 5000 });
}

function bindAsync(client, dn, password) {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => (err ? reject(err) : resolve()));
  });
}

// یک ورودی جستجوی LDAP (SearchResultEntry) را به شکل ساده { dn, attrs } تبدیل می‌کند
function toPlainEntry(entry) {
  const pojo = entry.pojo || {};
  const attrs = {};
  for (const attr of pojo.attributes || []) {
    attrs[attr.type] = attr.values.length === 1 ? attr.values[0] : attr.values;
  }
  return { dn: pojo.objectName, attrs };
}

function searchAsync(client, base, options) {
  return new Promise((resolve, reject) => {
    const entries = [];
    client.search(base, options, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', (entry) => entries.push(toPlainEntry(entry)));
      res.on('error', (searchErr) => reject(searchErr));
      res.on('end', () => resolve(entries));
    });
  });
}

function safeUnbind(client) {
  try {
    client.unbind();
  } catch (e) {
    // نادیده گرفتن خطای unbind
  }
}

/**
 * نام کاربری و رمز عبور را در برابر LDAP احراز هویت می‌کند و در صورت موفقیت
 * اطلاعات کاربر به همراه فهرست گروه‌هایی که عضو آن است را برمی‌گرداند.
 */
async function authenticate(username, password) {
  if (!username || !password) {
    throw new Error('نام کاربری و رمز عبور الزامی است');
  }

  const searchClient = createClient();
  let userClient;
  try {
    await bindAsync(searchClient, config.ldap.bindDN, config.ldap.bindPassword);

    const filter = `(${config.ldap.usernameAttribute}=${escapeFilterValue(username)})`;
    const users = await searchAsync(searchClient, config.ldap.userBase, {
      scope: 'sub',
      filter,
      attributes: ['dn', config.ldap.usernameAttribute, 'cn', 'mail'],
    });

    if (users.length === 0) {
      throw new Error('کاربر یافت نشد یا رمز عبور نادرست است');
    }
    const userDN = users[0].dn;
    const userCN = users[0].attrs.cn || username;

    // تایید رمز عبور با bind کردن مستقیم با حساب کاربر
    userClient = createClient();
    await bindAsync(userClient, userDN, password);

    // یافتن گروه‌هایی که کاربر عضو آن است
    const groupEntries = await searchAsync(searchClient, config.ldap.groupBase, {
      scope: 'sub',
      filter: `(&(objectClass=groupOfNames)(member=${escapeFilterValue(userDN)}))`,
      attributes: ['cn'],
    });
    const groups = groupEntries.map((g) => g.attrs.cn);

    return { username, dn: userDN, displayName: userCN, groups };
  } catch (err) {
    if (err instanceof ldap.InvalidCredentialsError) {
      throw new Error('نام کاربری و رمز عبور نادرست است');
    }
    throw err;
  } finally {
    safeUnbind(searchClient);
    if (userClient) safeUnbind(userClient);
  }
}

module.exports = { authenticate };
