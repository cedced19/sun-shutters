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