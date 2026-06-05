import { http, HttpResponse } from 'msw';

export const mswHandlers = [
  http.get('*/api/me', () => {
    return HttpResponse.json({
      user_id: '1',
      email: 'user@example.com',
      first_name: 'Test',
      last_name: 'User',
    });
  }),
];
