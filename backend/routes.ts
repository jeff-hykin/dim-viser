// Every Viser action, as an endpoint (http.ts). The UI calls these; so can Desktop's agent.
//
// The page frames the viser server a dimos manipulation blueprint runs (ManipulationModule with
// visualization={"backend": "viser"}; dimos/manipulation/visualization/viser, default 127.0.0.1:8095) in an iframe. This
// server keeps the target, checks it is reachable (so the page never frames a connection error) and says when it
// changes: `stateChanged("state")` (frontend topic state/state, through Desktop's relay; the page re-GETs api/state).
import { HttpError, type Route, stateChanged } from "./http.ts"
import { dimosApp } from "./dimos_app.ts"

export const DESCRIPTION =
    "Viser: shows the 3D manipulation planning view (viser) a dimos manipulation blueprint serves, inside Desktop"

export const DEFAULT_PORT = "8095"
const PROBE_TIMEOUT_MS = 2500

type Target = { host: string; port: string } | { url: string }

const dataDir = dimosApp.dataDir
const savedFile = dataDir ? `${dataDir}/target.json` : null

function load(): Target {
    try {
        if (savedFile) {
            return JSON.parse(Deno.readTextFileSync(savedFile)).target
        }
    } catch {
        // first run
    }
    return { host: "localhost", port: DEFAULT_PORT }
}

let target = load()
let reachable: boolean | null = null
let checkedAt: string | null = null
/** bumped by api/reconnect: pages reload the frame */
let reload = 0

/** the viser server's origin as this machine reaches it (what the probe checks) */
export function targetOrigin(t: Target = target): string {
    if ("url" in t) {
        try {
            return new URL(t.url).origin
        } catch {
            return t.url
        }
    }
    return `http://${t.host}${t.port ? `:${t.port}` : ""}`
}

export const isLoopback = (t: Target) =>
    !("url" in t) && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(t.host.split(":")[0])

export function state() {
    return {
        target,
        targetOrigin: targetOrigin(),
        /** the iframe's src; for a loopback target the page swaps in the host it reached Desktop at */
        frameUrl: "url" in target ? target.url : `${targetOrigin()}/`,
        loopback: isLoopback(target),
        reachable,
        checkedAt,
        reload,
        hint:
            'launch a manipulation blueprint whose ManipulationModule has visualization={"backend": "viser"} (e.g. xarm-perception-sim); viser listens on 127.0.0.1:8095 unless visualization_host/visualization_port say otherwise',
    }
}

function changed() {
    stateChanged("state")
}

async function save() {
    if (savedFile) {
        await Deno.writeTextFile(savedFile, JSON.stringify({ target }))
    }
}

/** Is the viser server answering? (any HTTP response counts) */
export async function probe(): Promise<boolean> {
    const origin = targetOrigin()
    let ok = false
    try {
        const response = await fetch(origin, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
        await response.body?.cancel()
        ok = true
    } catch {
        ok = false
    }
    if (origin !== targetOrigin()) {
        return ok // the target changed meanwhile: that change probes for itself
    }
    const before = reachable
    reachable = ok
    checkedAt = new Date().toISOString()
    if (before !== ok) {
        changed()
    }
    return ok
}

/** main.ts keeps the reachability fresh while the app runs */
export function startProbing(everyMs = 3000) {
    probe()
    return setInterval(probe, everyMs)
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : value === undefined ? "" : String(value))

export const routes: Route[] = [
    {
        method: "GET",
        path: "api/state",
        description:
            "Viser's state: which viser server it frames (host:port or URL), the frame URL, and whether it is reachable (it is only while a manipulation blueprint with the viser backend runs)",
        role: "context",
        handler: () => state(),
    },
    {
        method: "POST",
        path: "api/target",
        description:
            "Point at a viser server (the UI's host/port + Connect): host and port (default 8095) of the viser a manipulation blueprint serves, or url, a full http(s) URL. Answers whether it is reachable",
        params: {
            host: { type: "string", description: "viser host, e.g. localhost (or host:port)" },
            port: { type: "string", description: "viser port (default 8095)" },
            url: { type: "string", description: "a full http(s) URL instead of host/port" },
        },
        handler: async (args) => {
            const url = text(args.url)
            if (url) {
                if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) {
                    throw new HttpError(400, "url must be an http(s) URL of a viser server")
                }
                target = { url }
            } else {
                const host = text(args.host) || "localhost"
                const port = text(args.port) || (host.includes(":") ? "" : DEFAULT_PORT)
                if (/^https?:\/\//i.test(host)) {
                    target = { url: host }
                } else if (!/^[\w.\-\[\]:]+$/.test(host) || (port && !/^\d{1,5}$/.test(port))) {
                    throw new HttpError(400, "host must be a hostname (or host:port) and port a number")
                } else {
                    target = { host, port }
                }
            }
            reachable = null
            await save()
            changed()
            await probe()
            return state()
        },
    },
    {
        method: "POST",
        path: "api/reconnect",
        description: "Check the viser server again now and reload its frame (after its blueprint restarted)",
        handler: async () => {
            reload++
            await probe()
            changed()
            return state()
        },
    },
]
