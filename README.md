# OAuth1.0 header

Node.js lib for OAuth1.0 header generation.

## Installation

`npm install --save oauth-1-header`

## How to use

```
import { OAuth } from 'oauth-1-header';

const authorization = OAuth.authorize(
    {
        method: 'method', // DELETE, GET, PATCH, POST, PUT
        url: 'https://example.com/some-url?query=test',
    },
    {
        consumer: {
            key: 'key',
            secret: 'secret',
        },
    },
);
```

Then set `authorization` as one of your headers
