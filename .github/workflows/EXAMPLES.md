# GitHub Actions CI Examples

This document provides examples of using OpenSpec UI static export in GitHub Actions workflows.

## Deploy to GitHub Pages

This workflow exports your OpenSpec project and deploys it to GitHub Pages on every push to the main branch.

```yaml
# .github/workflows/deploy-specs.yml
name: Deploy Specs to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# Allow only one concurrent deployment
concurrency:
  group: 'pages'
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install OpenSpec UI
        run: npm install -g openspecui

      - name: Export static site
        run: openspecui export ./dist --clean

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## Deploy to Netlify

This workflow exports and deploys to Netlify.

```yaml
# .github/workflows/deploy-netlify.yml
name: Deploy to Netlify

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install OpenSpec UI
        run: npm install -g openspecui

      - name: Export static site
        run: openspecui export ./dist --clean

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v3
        with:
          publish-dir: './dist'
          production-deploy: true
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: 'Deploy from GitHub Actions'
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## Export on Pull Request

This workflow exports specs on every pull request to verify the export works.

```yaml
# .github/workflows/verify-export.yml
name: Verify Export

on:
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install OpenSpec UI
        run: npm install -g openspecui

      - name: Test export
        run: openspecui export ./test-export --clean

      - name: Check export size
        run: du -sh ./test-export

      - name: Upload export artifact
        uses: actions/upload-artifact@v4
        with:
          name: openspec-export
          path: ./test-export
          retention-days: 7
```

## Deploy with Custom Base Path

For deploying to a subdirectory (e.g., `/docs/`):

```yaml
# .github/workflows/deploy-subdir.yml
name: Deploy to Subdirectory

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install OpenSpec UI
        run: npm install -g openspecui

      - name: Export with base path
        run: openspecui export ./dist --base-path=/docs/ --clean

      - name: Deploy
        # ... your deployment step here
        run: echo "Deploy to hosting with /docs/ path"
```

## Tips

1. **Caching**: Add caching for faster builds:

   ```yaml
   - name: Cache node modules
     uses: actions/cache@v4
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
   ```

2. **Exit codes**: The export command returns proper exit codes:
   - `0` - Success
   - `1` - Validation errors
   - `2` - System errors (disk full, permissions)

3. **Large projects**: For projects with >100 specs, consider:
   - Using artifact caching between runs
   - Splitting into multiple deploy jobs
   - Monitoring export size warnings

4. **Preview deploys**: Create preview deployments for pull requests:
   ```yaml
   - name: Deploy preview
     if: github.event_name == 'pull_request'
     run: |
       openspecui export ./preview --clean
       # Deploy to preview URL
   ```
