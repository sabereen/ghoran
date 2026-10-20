# Publishing to npm

The project's seven public packages are published through the [Publish to npm workflow](https://github.com/sabereen/ghoran/actions/workflows/npm-release.yml).

Before publication, the workflow builds packages, checks TypeScript, runs tests, installs independent tarballs and builds documentation. A separate job then publishes those same tarballs with provenance. Already-published versions are skipped on reruns. Dependencies are published before their consumers.

## One-time npm/GitHub setup

This uses [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/), without `NPM_TOKEN`. An owner or maintainer of each package must configure Settings → Trusted Publisher in npm with GitHub Actions and these values:

| Field                | Value                                        |
| -------------------- | -------------------------------------------- |
| Organization or user | `sabereen`                                   |
| Repository           | `ghoran`                                     |
| Workflow filename    | `npm-release.yml`                            |
| Environment name     | Leave empty                                  |
| Allowed actions      | Allow direct publication using `npm publish` |

Configure all seven packages: `@ghoran/entity`, `@ghoran/font-page`, `@ghoran/metadata`, `@ghoran/text`, `@ghoran/translation`, `@ghoran/utils` and `@ghoran/search`. The workflow filename is only the filename, without `.github/workflows/`.

## First prepared release

The package manifests and lockfile have these prepared versions:

| Package               | Version  |
| --------------------- | -------- |
| `@ghoran/entity`      | `0.2.2`  |
| `@ghoran/font-page`   | `0.0.8`  |
| `@ghoran/metadata`    | `0.0.8`  |
| `@ghoran/text`        | `0.0.9`  |
| `@ghoran/translation` | `0.0.10` |
| `@ghoran/utils`       | `0.0.8`  |
| `@ghoran/search`      | `0.1.0`  |

After configuring Trusted Publisher, select **Run workflow** on `main`. Enable `dry_run` to test without publishing. It is disabled by default, so the default run really publishes.

## Subsequent releases

```bash
pnpm release:version patch
pnpm verify
git add .
git commit -m "chore: prepare npm release"
git push origin main
git tag npm-release-2
git push origin npm-release-2
```

Use a unique tag starting with `npm-`. Pushing such a tag triggers publication. The tag identifies the release run; each package version comes from its package.json. You can also use **Run workflow**. Only commits in the history of `main` may be published.

CI also runs on pushes to `main` and pull requests, without publishing. A code change without a version bump does not replace an existing npm version.

## Local testing

```bash
pnpm verify
pnpm release:pack
pnpm release:dry-run
```

Tarballs and the manifest are written to `work/npm-release/`. Direct local publication with `pnpm release:publish` requires valid npm authentication. Provenance is configured for GitHub Actions publication.

Before automatic publication, the owner must create `@ghoran/search` on npm for its first release and configure Trusted Publisher. The release script publishes `metadata` and `text` before `search`.

Run `pnpm check:search-browser` to test the real worker in an installed Chromium browser. Set `CHROME_BIN` to select the browser executable.
