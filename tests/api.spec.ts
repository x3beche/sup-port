import { expect, test } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:4000';

test.describe('Backend API (FastAPI + MongoDB)', () => {
  test('/health MongoDB bağlantısını doğrular', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', db: 'support' });
  });

  test('ticket yaşam döngüsü: oluştur, listele, güncelle, sil', async ({ request }) => {
    const created = await request.post(`${API}/api/tickets`, {
      data: { title: 'Playwright kaydı', description: 'otomatik test' },
    });
    expect(created.status()).toBe(201);

    const ticket = await created.json();
    expect(ticket).toMatchObject({
      title: 'Playwright kaydı',
      description: 'otomatik test',
      status: 'open',
    });
    expect(ticket.id).toMatch(/^[a-f0-9]{24}$/);

    try {
      const list = await request.get(`${API}/api/tickets?limit=50`);
      expect(list.status()).toBe(200);
      const ids = (await list.json()).map((t: { id: string }) => t.id);
      expect(ids).toContain(ticket.id);

      const patched = await request.patch(`${API}/api/tickets/${ticket.id}`, {
        data: { status: 'closed' },
      });
      expect(patched.status()).toBe(200);
      const updated = await patched.json();
      expect(updated.status).toBe('closed');
      // Both timestamps must round-trip in the same shape (tz-aware UTC).
      expect(updated.created_at).toMatch(/(Z|\+00:00)$/);
      expect(updated.updated_at).toMatch(/(Z|\+00:00)$/);
    } finally {
      const removed = await request.delete(`${API}/api/tickets/${ticket.id}`);
      expect(removed.status()).toBe(204);
    }

    const gone = await request.get(`${API}/api/tickets/${ticket.id}`);
    expect(gone.status()).toBe(404);
  });

  test('geçersiz girdiler doğru hata kodlarını döner', async ({ request }) => {
    expect((await request.get(`${API}/api/tickets/not-an-id`)).status()).toBe(400);
    expect((await request.post(`${API}/api/tickets`, { data: { title: '' } })).status()).toBe(422);
    expect(
      (await request.patch(`${API}/api/tickets/507f1f77bcf86cd799439011`, { data: {} })).status(),
    ).toBe(400);
  });
});
