# Setup Instructions

## For Local Development

To use this package in your project before publishing to npm:

### Option 1: npm link (Recommended for development)

1. In the `mailgun-inbound-email` directory:
```bash
cd /home/ritik-ls/Desktop/mailgun-inbound-email
npm link
```

2. In your project directory:
```bash
cd /home/ritik-ls/Desktop/node_skeleton
npm link mailgun-inbound-email
```

### Option 2: Install from local path

In your project's `package.json`, add:
```json
{
  "dependencies": {
    "mailgun-inbound-email": "file:../mailgun-inbound-email"
  }
}
```

Then run:
```bash
npm install
```

### Option 3: Publish to npm (for production use)

1. Update `package.json` with your details (name, author, etc.)
2. Login to npm:
```bash
npm login
```

3. Publish:
```bash
npm publish
```

4. Then install in your project:
```bash
npm install mailgun-inbound-email
```

## After Setup

Make sure to install dependencies in the package directory:
```bash
cd /home/ritik-ls/Desktop/mailgun-inbound-email
npm install
```

