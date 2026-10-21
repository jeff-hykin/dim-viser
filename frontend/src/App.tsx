// Viser page: frames the viser server a dimos manipulation blueprint serves (inner iframe) once the backend says it's
// reachable, so a down server never shows the browser's "unable to connect" page; once connected the controls collapse
// into a pill (click to edit). Every action is a backend endpoint (api.ts); state is api/state, re-read when the backend
// says it changed (useBackendState: zenoh topic state/state), so the agent's changes show here too. The UI is
// dimos-react's; the framed page itself is viser's own web client (served by the Python viser server).
import { useEffect, useState } from "react"
import {
    Alert,
    AppShell,
    Button,
    Embed,
    EmptyState,
    Hud,
    StatusDot,
    Text,
    TextInput,
    Toolbar,
    useBackendState,
    useMobile,
} from "dimos-react"
import { call } from "./api.ts"
// @deno-types="./dim-app/source/desktop.d.ts"
import { openApp, type OpenAppParams, underDesktop } from "./dim-app/source/desktop.js"

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
const LAUNCHER: OpenAppParams = { query: "xarm" }

export function App() {
    const [state, { error: stateError }] = useBackendState("state", { url: "api/state" }) as [
        State | undefined,
        { error: Error | null },
    ]
    const [host, setHost] = useState("")
    const [port, setPort] = useState("")
    const [expanded, setExpanded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const mobile = useMobile(600)

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
    const looking = state?.reachable === null || !state
    return (
        <AppShell insetBottom>
            {src && (
                <Embed
                    key={`${src}#${state?.reload}`}
                    id="viewer"
                    title="Viser planning view"
                    src={src}
                    allow="fullscreen; clipboard-read; clipboard-write"
                />
            )}

            {!connected && (!state && stateError
                ? (
                    <EmptyState
                        layer
                        data-testid="onboard-backend-down"
                        tone="warn"
                        icon="warn"
                        title="The Viser app's server isn't answering"
                        message="Restarting the app usually fixes it: close it with ✕ and open it again."
                        actions={<Button variant="primary" onClick={() => location.reload()}>Try again</Button>}
                    />
                )
                : (
                    <EmptyState
                        layer
                        data-testid="onboard-no-viser"
                        icon={looking ? "search" : "info"}
                        title={looking ? "Looking for viser…" : "No manipulation planning view is running"}
                        message={`Launch a manipulation blueprint whose planner uses the viser view (for example xarm-perception-sim, in simulation). This page keeps looking at ${
                            state?.targetOrigin ?? "…"
                        } and shows it as soon as it answers.`}
                        actions={underDesktop()
                            ? (
                                <Button variant="primary" icon="external" onClick={() => openApp("launcher", LAUNCHER)}>
                                    Open the Launcher
                                </Button>
                            )
                            : null}
                    />
                ))}

            <Hud position={mobile && !collapsed ? "top-left" : "top"} style={mobile && !collapsed ? { right: 0 } : {}}>
                <Toolbar
                    floating
                    onClick={() => collapsed && setExpanded(true)}
                    style={collapsed ? { cursor: "pointer" } : undefined}
                    title={collapsed ? "click to change the viser server" : undefined}
                >
                    {/* inside Desktop, its window bar already names the app */}
                    {self === top && <Text className="dr-title">Viser</Text>}
                    {!collapsed && (
                        <>
                            <TextInput
                                id="host"
                                size="sm"
                                mono
                                placeholder="host"
                                aria-label="host"
                                spellCheck={false}
                                autoComplete="off"
                                value={host}
                                onChange={setHost}
                                onEnter={connect}
                                style={{ width: mobile ? undefined : 150, flex: mobile ? 1 : undefined }}
                            />
                            <TextInput
                                id="port"
                                size="sm"
                                mono
                                placeholder="port"
                                aria-label="port"
                                inputMode="numeric"
                                spellCheck={false}
                                autoComplete="off"
                                value={port}
                                onChange={setPort}
                                onEnter={connect}
                                style={{ width: 72 }}
                            />
                            <Button
                                id="connect"
                                size="sm"
                                variant="primary"
                                onClick={(event) => (event.stopPropagation(), connect())}
                            >
                                Connect
                            </Button>
                        </>
                    )}
                    <StatusDot tone={connected ? "ok" : looking ? "warn" : "danger"} pulse={looking} />
                    <Text mono small muted title={state?.targetOrigin ?? ""}>
                        {connected ? "connected" : "waiting…"}
                    </Text>
                </Toolbar>
                {error && <Alert tone="danger" onClose={() => setError(null)}>{error}</Alert>}
            </Hud>
        </AppShell>
    )
}
