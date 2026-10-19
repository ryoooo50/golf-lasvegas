import { buildShareUrl } from './roundShares';

jest.mock('../lib/apiBase', () => ({ getApiBaseUrl: () => 'https://golf.example' }));
jest.mock('../lib/authClient', () => ({
    API_CREDENTIALS: 'include',
    getAuthHeaders: jest.fn(() => Promise.resolve({})),
}));

describe('roundShares', () => {
    test('builds a share URL with the token as a query parameter', () => {
        expect(buildShareUrl('a_b-C')).toBe('https://golf.example/share?token=a_b-C');
    });
});
