const target = process.env.VICANHR_API_URL || 'http://127.0.0.1:8080';

module.exports = [
  {
    context: [
      '/api/**',
      '/admin',
      '/admin/**',
      '/attendance/login/',
      '/attendance/upload/',
      '/static/admin/**',
    ],
    target,
  },
];
