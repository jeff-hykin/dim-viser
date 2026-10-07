import { assertEquals } from "@std/assert"
import { handle } from "./http.ts"
import { DESCRIPTION, routes } from "./routes.ts"

const call = async (method: string, path: string, body?: unknown) => {
    const response = await handle(
        new Request(`http://app/${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
        routes,
        DESCRIPTION,
    )
    const text = await response!.text()
    let json
    try {
        json = JSON.parse(text)
    } catch {
        json = text
    }
    return { status: response!.status, json }
}

Deno.test("api/state: localhost:8095 by default, a loopback target", async () => {
    const { json } = await call("GET", "api/state")
    assertEquals(json.target, { host: "localhost", port: "8095" })
    assertEquals([json.frameUrl, json.loopback], ["http://localhost:8095/", true])
    assertEquals((await call("GET", "api/states")).status, 404)
})

Deno.test("api/target: a reachable server (a stand-in), an unreachable one, bad input", async () => {
    const server = Deno.serve({ port: 0, onListen: () => {} }, () => new Response("viser"))
    const { port } = server.addr as Deno.NetAddr
    const up = await call("POST", "api/target", { host: "127.0.0.1", port: String(port) })
    assertEquals([up.json.reachable, up.json.targetOrigin], [true, `http://127.0.0.1:${port}`])
    await server.shutdown()
    const again = await call("POST", "api/reconnect")
    assertEquals([again.json.reachable, again.json.reload], [false, 1])
    assertEquals((await call("POST", "api/target", { host: "bad host!" })).status, 400)
    assertEquals((await call("POST", "api/target", { url: "ftp://x" })).status, 400)
    const full = await call("POST", "api/target", { url: "http://robot.local:8095/" })
    assertEquals([full.json.frameUrl, full.json.loopback], ["http://robot.local:8095/", false])
    await call("POST", "api/target", { host: "localhost", port: "8095" })
})

Deno.test("agent.json lists every route", async () => {
    const { json } = await call("GET", "agent.json")
    assertEquals(json.endpoints.length, routes.length)
})
