module.exports = {
  apps: [
    {
      name: 'iot-server-dev',
      script: './dist/main.js',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
