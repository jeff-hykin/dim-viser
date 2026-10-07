// Viser page: frames the viser server a dimos manipulation blueprint serves (inner iframe) once the backend says it's
// reachable, so a down server never shows the browser's "unable to connect" page; once connected the controls collapse
// into a pill (click to edit). Every action is a backend endpoint (api.ts); state is api/state, re-read when the backend
// says it changed (useBackendState: zenoh topic state/state), so the agent's changes show here too.
import { useEffect, useState } from "react"
import { call } from "./api.ts"
import type { OpenAppParams } from "./dim-app/source/desktop.js"
import { EmptyState, useBackendState } from "./dim-app/source/react.js"

type State = {
    target: { host: string; port: string } | { url: string }
    targetOrigin: string
    frameUrl: string
    /** the target is this machine's loopback: the page frames it at the host it reached Desktop at instead */
    loopback: boolean
    reachable: boolean | null
    reload: number
}

/** a loopback target is the Desktop machine: from another computer that's the host this page came from */
function resolve(state: State): string {
    if (!state.loopback) {
        return state.frameUrl
    }
    const url = new URL(state.frameUrl)
    url.hostname = location.hostname
    return url.href
}

/** the Launcher, filtered to blueprints that run a viser planning view */
const LAUNCHER: OpenAppParams = { kind: "blueprint", query: "xarm" }

export function App() {
    const [state, { error: stateError }] = useBackendState<State>("api/state")
    const [host, setHost] = useState("")
    const [port, setPort] = useState("")
    const [expanded, setExpanded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (state) {
            setHost("url" in state.target ? state.target.url : state.target.host)
            setPort("url" in state.target ? "" : state.target.port)
        }
    }, [state])
    useEffect(() => setError(stateError?.message ?? null), [stateError])

    const connect = () => {
        setExpanded(false)
        call("POST", "api/target", { host, port }).then(() => setError(null), (e) => setError(e.message))
    }

    const connected = state?.reachable === true
    const collapsed = connected && !expanded
    const src = connected && state ? resolve(state) : undefined
    return (
        <div className="frame-wrap">
            {src && (
                <iframe
                    key={`${src}#${state?.reload}`}
                    id="viewer"
                    title="Viser planning view"
                    src={src}
                    allow="fullscreen; clipboard-read; clipboard-write"
                />
            )}

            <div className={`overlay${connected ? "" : " show"}`}>
                {!connected && (
                    <EmptyState
                        {...(!state && stateError
                            ? {
                                testId: "onboard-backend-down",
                                label: "Server not answering",
                                tone: "warn" as const,
                                title: "The Viser app's server isn't answering",
                                body: "Restarting the app usually fixes it: close it with ✕ and open it again.",
                                actions: [{ label: "Try again", onClick: () => location.reload() }],
                            }
                            : {
                                testId: "onboard-no-viser",
                                label: state?.reachable === null || !state ? "Looking for viser" : "No viser running",
                                busy: state?.reachable === null || !state,
                                title: "No manipulation planning view is running",
                                body:
                                    `Launch a manipulation blueprint whose planner uses the viser view (for example xarm-perception-sim, in simulation). This page keeps looking at ${
                                        state?.targetOrigin ?? "…"
                                    } and shows it as soon as it answers.`,
                                actions: [{ label: "Open the Launcher", app: "launcher", params: LAUNCHER }],
                            })}
                    />
                )}
                {error && <div className="dim-alert warn">{error}</div>}
            </div>

            <div
                className={`panel dim-panel glass${collapsed ? " collapsed" : ""}`}
                onClick={() => collapsed && setExpanded(true)}
            >
                {/* inside Desktop, its window bar already names the app */}
                {window.parent === window && <span className="title dim-title">Viser</span>}
                <label className="dim-label">host</label>
                <input
                    className="dim-input dim-mono"
                    id="host"
                    type="text"
                    spellCheck={false}
                    autoComplete="off"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && connect()}
                />
                <label className="dim-label">port</label>
                <input
                    className="dim-input dim-mono"
                    id="port"
                    type="text"
                    inputMode="numeric"
                    spellCheck={false}
                    autoComplete="off"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && connect()}
                />
                <button
                    type="button"
                    className="dim-btn primary"
                    id="connect"
                    onClick={(e) => (e.stopPropagation(), connect())}
                >
                    Connect
                </button>
                <span className="stat" title={state?.targetOrigin ?? ""}>
                    <span className={`dot${connected ? " on" : " err"}`} />
                    <span>{connected ? "connected" : "waiting…"}</span>
                </span>
                {error && <span className="dim-alert danger">{error}</span>}
            </div>
        </div>
    )
}
