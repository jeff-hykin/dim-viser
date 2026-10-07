# dim-viser

A [dimOS Desktop](https://github.com/jeff-hykin/dimos-desktop) app that shows the **viser manipulation planning view**
inside Desktop: the 3D scene, targets and plans a dimos manipulation blueprint serves when its `ManipulationModule` has
`visualization={"backend": "viser"}` (for example `xarm-perception-sim`).

```sh
dimos-desktop install https://github.com/jeff-hykin/dim-viser
```

It frames whatever viser server dimos runs (default `localhost:8095`; dimos's `visualization_host` /
`visualization_port` move it) once it answers, retrying until then; once connected the controls collapse into a pill
(click it to edit). A `localhost` target is framed at the host the page reached Desktop at, so from another computer
viser must listen beyond loopback (`visualization_host=0.0.0.0`) or its port be forwarded too.

## Endpoints

Every action is an HTTP endpoint (`backend/routes.ts`, served as `agent.json` and listed in `dimos.yaml`), so Desktop's
agent drives the app like the UI does:

| endpoint             | what                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `GET api/state`      | the viser server framed, the frame URL, whether it is reachable            |
| `POST api/target`    | `host` + `port` (or `url`): point at a viser server                        |
| `POST api/reconnect` | check the server again and reload the frame (after its blueprint restarts) |

There is no `view` endpoint: viser is a cross-origin iframe, so neither the page nor the server can capture it.

## Development

```sh
deno task test && deno task check     # backend tests, dimos.yaml ↔ routes check
cd frontend && npm install && npm run typecheck && npm run build
deno task dev                         # backend on :8787; `npm run dev` in frontend proxies api/ to it
nix build .#dimosApp                  # what Desktop builds: bin/dimos-app-server
```

Licensed under Apache-2.0.
