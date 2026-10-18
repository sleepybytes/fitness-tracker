// Adds personal / machine-specific values on top of app.json without committing them.
// They come from .env.local (git-ignored; Expo CLI loads it automatically). See .env.example.
const { APPLE_TEAM_ID, APP_BUNDLE_ID } = process.env;

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    ...(APP_BUNDLE_ID ? { bundleIdentifier: APP_BUNDLE_ID } : {}),
    ...(APPLE_TEAM_ID ? { appleTeamId: APPLE_TEAM_ID } : {}),
  },
});
