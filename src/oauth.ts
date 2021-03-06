import { createHmac } from 'crypto';
import {
  OAuthData,
  OAuthDataClass,
  OAuthOptions,
  OAuthRequest,
  OAuthToHeaderOptions,
  OAuthToken,
} from './oauth.type';

export class OAuth {
  static WORD_CHARACTERS =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  static authorize(
    request: OAuthRequest,
    opts: OAuthOptions,
    token?: OAuthToken,
  ): string {
    return OAuth.generateAuthorization(request, opts, token).toHeader();
  }

  static generateAuthorization(
    request: OAuthRequest,
    opts: OAuthOptions,
    token?: OAuthToken,
  ): OAuthDataClass {
    const oauthData: OAuthData = {
      oauth_consumer_key: opts.consumer.key ?? '',
      oauth_nonce: opts.nonce ?? OAuth.generateNonce(opts.nonceLength),
      oauth_signature_method: opts.signatureMethod ?? 'HMAC-SHA1',
      oauth_timestamp:
        opts.timestamp ?? Math.round(new Date().getTime() / 1000).toString(),
      oauth_version: opts.version ?? '1.0',
    };

    if (token?.key) {
      oauthData.oauth_token = token.key;
    }

    oauthData.oauth_signature = OAuth.generateSignature(
      request,
      oauthData,
      opts.consumer.secret!,
      token?.secret,
      opts.encodeSignature,
      opts.signatureMethod,
    );

    return {
      ...oauthData,
      toHeader: () => OAuth.generateHeader(oauthData, opts),
    };
  }

  static generateHeader(oauthData: OAuthData, opts?: OAuthToHeaderOptions) {
    const sorted = OAuth.sortKeys(oauthData);

    const header = opts?.realm ? [`realm="${opts.realm}"`] : [];

    for (const { key, value } of sorted) {
      if (!key.startsWith('oauth_')) continue;
      header.push(`${OAuth.encode(key)}="${OAuth.encode(value)}"`);
    }

    const parameterSeperator = opts?.parameterSeperator ?? ', ';

    return `OAuth ${header.join(parameterSeperator)}`;
  }

  static generateNonce(length = 32) {
    const charsLength = OAuth.WORD_CHARACTERS.length;
    return Array.from({ length: length }, () => {
      const charIndex = Math.round(Math.random() * charsLength);
      return OAuth.WORD_CHARACTERS[charIndex];
    }).join('');
  }

  static generateSignature(
    request: OAuthRequest,
    oauthData: OAuthData,
    consumerSecret: OAuthToken['secret'],
    tokenSecret?: string,
    encode: boolean = false,
    signatureMethod: string = 'HMAC-SHA1',
  ) {
    const urlBaseEncoded = OAuth.encode(request.url.split('?')[0]);
    const paramsStringEncoded = OAuth.encodeParameters(
      oauthData,
      request.query,
      request.body,
    );
    const _value = `${request.method}&${urlBaseEncoded}&${paramsStringEncoded}`;

    const signingKey = OAuth.generateSigningKey(consumerSecret, tokenSecret);
    const signature = OAuth.hash(_value, signingKey, signatureMethod);

    if (encode) return OAuth.encode(signature);
    return signature;
  }

  static encodeParameters(
    oauthData: OAuthData,
    query: OAuthRequest['query'] = {},
    body: OAuthRequest['body'] = {},
  ) {
    const params: Record<string, any> = {
      ...oauthData,
      ...query,
      ...(oauthData.oauth_body_hash ? body : {}),
    };

    const encodedParams: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(params)) {
      encodedParams[OAuth.encode(key)] =
        value && Array.isArray(value)
          ? value.map(OAuth.encode)
          : OAuth.encode(value);
    }

    const encodedParamsSorted = OAuth.sortKeys(encodedParams);

    const values = [];
    for (const { key, value } of encodedParamsSorted) {
      if (value && Array.isArray(value)) {
        value.sort();
        values.push(...value.map(item => `${key}=${item}`));
      } else {
        values.push(`${key}=${value}`);
      }
    }

    return OAuth.encode(values.join('&'));
  }

  static generateSigningKey(consumerSecret?: string, tokenSecret?: string) {
    const consumerSecretEncoded = OAuth.encode(consumerSecret);
    const tokenSecretEncoded = OAuth.encode(tokenSecret);
    return `${consumerSecretEncoded}&${tokenSecretEncoded}`;
  }

  static hash(
    value: string,
    signingKey: string,
    signatureMethod: string = 'HMAC-SHA1',
  ) {
    switch (signatureMethod) {
      case 'HMAC-SHA1':
        return createHmac('sha1', signingKey).update(value).digest('base64');
      case 'HMAC-SHA256':
        return createHmac('sha256', signingKey).update(value).digest('base64');
      /* c8 ignore start */
      default:
        return value;
      /* c8 ignore stop */
    }
  }

  // https://datatracker.ietf.org/doc/html/rfc3986
  static encode(str?: string) {
    if (!str) return '';
    return encodeURIComponent(str).replace(
      /[!'()\*]/g,
      char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  static sortKeys(obj: Record<string, any>) {
    return Object.keys(obj)
      .sort()
      .map(key => ({ key, value: obj[key] }));
  }
}
