# sun-shutters
Open shutters on sunrise, close them on sunset!

Available using Docker: `docker pull cedced19/sun-shutters`.

This package use [tuya-switch-api](https://github.com/cedced19/tuya-switch-api).

Create a `shutters.json` with:
```json
[
    {
        "id": "...",
        "name": "Cuisine",
        "after_sunset": 30
    },
    {
        "id": "...",
        "name": "Salon 2",
        "after_sunset": 30
    },
    {
        "id": "...",
        "name": "Salon 1",
        "after_sunset": 30
    },
    {
        "id": "...",
        "name": "Salon 3",
        "after_sunset": 30
    },
    {
        "id": "...",
        "name": "Salle à manger",
        "after_sunset": 90
    }
]
```

I got `id` field with: `tuya.discover(cb)`.

You also have to create a `config.json` file with:
```json
{
    "email": "...",
    "password": "...",
    "lat": 48.760425,
    "long": 7.257013
}
```

> Note: authentication now uses the Tuya IoT OpenAPI (client id/secret + token), not the
> legacy email/password endpoint. The `email`/`password` fields above are no longer used for
> auth — only `lat`/`long` are used (for sunset calculation).

## One-time setup: authenticate with Tuya (required)

Before the open/close scripts (and the scheduler) can control the shutters, you must
obtain and save a Tuya access token once. The token server does this for you.

1. Make sure dependencies are installed:

   ```
   cd app
   npm install
   ```

2. Start the token server:

   ```
   node token-server.js
   ```

3. Open http://127.0.0.1:3000 in a browser and fill in:

   - **Region** — the data center of your Tuya cloud project (e.g. `EU`)
   - **Access ID (client_id)**
   - **Access Secret (client_secret)**

   Both the Access ID and Access Secret are on your cloud project's Overview page
   ([iot.tuya.com](https://iot.tuya.com) → Cloud → your project).

4. Click **Get token**.

The server saves your credentials to `app/credentials.json` and the access/refresh token to
`app/token.json` (both gitignored). These two files are what the open/close scripts and the
scheduler read, so everything works from then on.

This is a one-time step — the library reuses and auto-refreshes the saved token. You only
need to run `token-server.js` again if the refresh token can no longer be renewed (e.g. after
a long time offline), in which case use its **Refresh token** button (or click **Get token**
again).

## Close all shutters

To close every shutter right away (no scheduling), run from `app/`:

```
node test-close.js --config /home/cjung/perso/server-config/sun-shutters
```

`--config` points to a directory containing both `config.json` and `shutters.json`.

## Open all shutters

To open every shutter right away (no scheduling), run from `app/`:

```
node test-open.js --config /home/cjung/perso/server-config/sun-shutters
```

`--config` points to a directory containing both `config.json` and `shutters.json`.

## Docker

Build docker image:
```
docker build -t sun-shutter .
```

Test:
```
docker-compose up
```

Docker compose:
```
docker-compose up -d
```

Share to [Docker Hub](https://hub.docker.com/r/cedced19/sun-shutters):
```
docker tag sun-shutter:latest cedced19/sun-shutters:1.0
docker push cedced19/sun-shutters:1.0
```

Multiplatform
```
docker buildx build   --platform linux/amd64,linux/arm64   -t cedced19/sun-shutters:latest   --push .
```