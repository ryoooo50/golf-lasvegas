import { toAuthErrorKey } from './authErrorMessage';

describe('toAuthErrorKey', () => {
    test.each([
        ['Load failed'],
        ['Failed to fetch'],
        ['Network request failed'],
        ['NetworkError when attempting to fetch resource.'],
    ])('maps fetch failure "%s" to the network message', (message) => {
        expect(toAuthErrorKey(new TypeError(message))).toEqual({ key: 'auth.errorNetwork' });
    });

    test('maps a better-auth error with status 0 to the network message', () => {
        expect(toAuthErrorKey({ status: 0, statusText: '', message: 'Load failed' })).toEqual({ key: 'auth.errorNetwork' });
    });

    test.each([
        ['USER_ALREADY_EXISTS', 'auth.errorAlreadyRegistered'],
        ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'auth.errorAlreadyRegistered'],
        ['INVALID_EMAIL_OR_PASSWORD', 'auth.errorInvalidCredentials'],
        ['EMAIL_NOT_VERIFIED', 'auth.errorEmailNotConfirmed'],
        ['PASSWORD_TOO_SHORT', 'auth.errorWeakPassword'],
        ['INVALID_EMAIL', 'auth.errorInvalidEmail'],
    ])('maps better-auth error code %s', (code, key) => {
        expect(toAuthErrorKey({ code, status: 400, statusText: 'Bad Request', message: 'x' })).toEqual({ key });
    });

    test('maps HTTP 429 to the rate limit message', () => {
        expect(toAuthErrorKey({ status: 429, statusText: 'Too Many Requests', message: '' })).toEqual({ key: 'auth.errorRateLimit' });
    });

    test('maps server errors to the server message', () => {
        expect(toAuthErrorKey({ status: 500, statusText: 'Internal Server Error', message: '' })).toEqual({ key: 'auth.errorServer' });
    });

    test('keeps the original message as detail for unknown errors', () => {
        expect(toAuthErrorKey(new Error('boom'))).toEqual({ key: 'auth.errorUnknown', detail: 'boom' });
        expect(toAuthErrorKey({ status: 418, statusText: "I'm a teapot", message: 'odd' })).toEqual({ key: 'auth.errorUnknown', detail: 'odd' });
        expect(toAuthErrorKey('weird')).toEqual({ key: 'auth.errorUnknown', detail: 'weird' });
    });

    test('maps a banned user to the banned message', () => {
        expect(toAuthErrorKey({ code: 'BANNED_USER', status: 403, message: 'You have been banned' })).toEqual({ key: 'auth.errorBanned' });
    });
});
