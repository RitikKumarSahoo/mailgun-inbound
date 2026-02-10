# Setup Instructions

## For Local Development

To use this package in your project before publishing to npm:

### Option 1: npm link (Recommended for development)

1. In the `node-inbound-email` directory:
```bash
cd /home/ritik-ls/Desktop/node-inbound-email
npm link
```

2. In your project directory:
```bash
cd /home/ritik-ls/Desktop/node_skeleton
npm link node-inbound-email
```

### Option 2: Install from local path

In your project's `package.json`, add:
```json
{
  "dependencies": {
    "node-inbound-email": "file:../node-inbound-email"
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
npm install node-inbound-email
```

## After Setup

Make sure to install dependencies in the package directory:
```bash
cd /home/ritik-ls/Desktop/node-inbound-email
npm install
```


