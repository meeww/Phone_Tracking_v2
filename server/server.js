const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));

// Express Session without MongoStore
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: true,
}));

// Configure Passport
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'https://phone-tracking.onrender.com/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  // Save user profile or token as needed
  return done(null, profile);
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get('/auth/google/callback', passport.authenticate('google', {
  failureRedirect: '/'
}), (req, res) => {
  res.redirect('/profile');
});

app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/google');
  }
  res.send(`Hello, ${req.user.displayName}`);
});

// Endpoint to receive data from the phone
app.post('/send-data', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Unauthorized');
  }
  // Handle the sensor data
  console.log(req.body);
  res.send('Data received');
});

// Serve the client HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
