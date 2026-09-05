const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const morgan = require('morgan');
const path = require('path');
const config = require('./src/config');
const authRoutes = require('./src/routes/auth');
const formRoutes = require('./src/routes/forms');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 },
  })
);
app.use(flash());

app.use('/', authRoutes);
app.use('/', formRoutes);

app.use((req, res) => {
  res.status(404).render('not-found');
});

app.listen(config.port, () => {
  console.log(`سرویس فرم بازرگانی روی پورت ${config.port} در حال اجراست`);
});
