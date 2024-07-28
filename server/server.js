const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(cors({
    origin: 'https://phone-tracking-v2.onrender.com', // Update with your client URL
    credentials: true
}));
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
  callbackURL: 'https://phone-tracking-v2.onrender.com/auth/google/callback'
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

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected');

  // Join the room based on user ID
  socket.on('join', (userId) => {
    socket.join(userId);
    io.to(userId).emit('message', `User with ID ${userId} has connected`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Node server has started successfully on: https://phone-tracking-v2.onrender.com')
});
