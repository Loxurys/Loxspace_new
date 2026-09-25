# Loxspace

## Local writing

Run `start-local.cmd` to open the Blog & Project Maker. New entries are generated as HTML files under `Page/blogs/` or `Page/projects/`; their local manifests stay in `Page/`.

## Netlify preview

Run `start-netlify.cmd` to preview the site and comments through Netlify Dev at `http://localhost:8888`. The Blog Maker remains available in this local preview, but is excluded from the public build.

## Deploy

Connect the repository to Netlify. The settings in `netlify.toml` build the public site into `dist/`, omit the local Maker and its manifests, and deploy the comments Function. Comments are stored per blog or project in Netlify Blobs; visitors do not need accounts.
