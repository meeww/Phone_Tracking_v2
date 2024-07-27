# Phone Sensor Data Project

## Client Setup

1. Host the `client` directory on GitHub Pages.
2. Open `index.html` in a web browser to see the interface.

## Server Setup

1. Navigate to the `server` directory.
2. Install dependencies: `npm install`
3. Start the server: `npm start`
4. The server will be running on `http://localhost:3000`.

## OAuth2 Setup

1. Create a project on the Google Developer Console.
2. Enable the Google+ API.
3. Configure the OAuth consent screen.
4. Create OAuth 2.0 credentials and set the callback URL to `http://localhost:3000/auth/google/callback`.
5. Update the `server.js` file with your Google Client ID and Client Secret.
6. (Optional) Store credentials in a `.env` file.
